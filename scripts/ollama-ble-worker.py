#!/usr/bin/env python3
"""
Ollama BLE Provider Script
Provides Ollama LLM service simulation for Bluetooth Low Energy

Usage:
    python3 ollama-ble-worker.py [--model phi3] [--device-name "My Laptop"]

Installation:
    # Install minimal dependencies
    pip install -r requirements-minimal.txt

    # Or install all dependencies (recommended)
    pip install -r requirements.txt

Requirements:
    - Python 3.8+
    - requests (HTTP client)
    - bleak (BLE library)
    - ollama serve (running in background)

Note: This script simulates BLE server functionality for testing.
For full BLE server implementation, platform-specific code is required:
- Linux: bluez with D-Bus API
- macOS: CoreBluetooth framework
- Windows: Windows.Devices.Bluetooth.Advertisement
"""

import asyncio
import json
import logging
import sys
import time
import uuid
from typing import Dict, Any, Optional
import argparse

try:
    import requests
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install requests")
    sys.exit(1)

try:
    from bleak import BleakGATTCharacteristic
    # Note: BleakGATTServer is not available in standard bleak
    # This is for type hints only
except ImportError as e:
    print(f"Missing BLE dependency: {e}")
    print("Install with: pip install bleak")
    print("Note: Full BLE server functionality requires platform-specific implementation")
    # Define a placeholder for type hints
    class BleakGATTCharacteristic:
        pass

# BLE Service and Characteristic UUIDs (must match the React Native app)
LEAI_SERVICE_UUID = "12345678-1234-1234-1234-123456789abc"
LEAI_QUERY_CHARACTERISTIC_UUID = "87654321-4321-4321-4321-cba987654321"
LEAI_RESPONSE_CHARACTERISTIC_UUID = "11111111-2222-3333-4444-555555555555"
LEAI_STATUS_CHARACTERISTIC_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class OllamaBLEProvider:
    def __init__(self, model_name: str = "phi3", device_name: str = "Ollama Provider"):
        self.model_name = model_name
        self.device_name = device_name
        self.ollama_url = "http://localhost:11434"
        self.is_processing = False
        self.server = None

        # Check if Ollama is running
        self._check_ollama()

    def _check_ollama(self):
        """Check if Ollama is running and the model is available"""
        try:
            # Check if Ollama is running
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
            if response.status_code != 200:
                raise Exception("Ollama not responding")

            models = response.json().get("models", [])
            model_names = [model["name"] for model in models]

            if self.model_name not in model_names:
                logger.warning(f"Model '{self.model_name}' not found. Available models: {model_names}")
                if model_names:
                    self.model_name = model_names[0]
                    logger.info(f"Using available model: {self.model_name}")
                else:
                    raise Exception("No models available in Ollama")

            logger.info(f"✅ Ollama running with model: {self.model_name}")

        except Exception as e:
            logger.error(f"❌ Ollama not available: {e}")
            logger.error("Make sure Ollama is running: ollama serve")
            sys.exit(1)

    async def query_ollama(self, prompt: str, context: Optional[str] = None) -> Dict[str, Any]:
        """Query Ollama with the given prompt"""
        try:
            # Build the full prompt with context if provided
            full_prompt = prompt
            if context:
                full_prompt = f"Context: {context}\n\nQuestion: {prompt}\n\nAnswer:"

            # Prepare the request
            request_data = {
                "model": self.model_name,
                "prompt": full_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "top_p": 0.85,
                    "num_predict": 512
                }
            }

            logger.info(f"🤖 Querying Ollama with prompt: {prompt[:50]}...")
            start_time = time.time()

            # Make the request to Ollama
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json=request_data,
                timeout=60
            )

            if response.status_code != 200:
                raise Exception(f"Ollama API error: {response.status_code}")

            result = response.json()
            processing_time = (time.time() - start_time) * 1000  # Convert to milliseconds

            logger.info(f"✅ Ollama response received in {processing_time:.0f}ms")

            return {
                "text": result.get("response", ""),
                "modelUsed": self.model_name,
                "processingTime": processing_time,
                "tokensGenerated": result.get("eval_count", 0),
                "error": None
            }

        except Exception as e:
            logger.error(f"❌ Ollama query failed: {e}")
            return {
                "text": f"Error: {str(e)}",
                "modelUsed": self.model_name,
                "processingTime": 0,
                "tokensGenerated": 0,
                "error": str(e)
            }

    async def handle_query_characteristic_write(self, characteristic: BleakGATTCharacteristic, data: bytes):
        """Handle incoming query from BLE client"""
        try:
            # Parse the query
            query_data = json.loads(data.decode('utf-8'))
            query_id = query_data.get('id', 'unknown')
            prompt = query_data.get('prompt', '')
            context = query_data.get('context')

            logger.info(f"📥 Received query {query_id}: {prompt[:50]}...")

            # Process the query
            self.is_processing = True
            response_data = await self.query_ollama(prompt, context)
            self.is_processing = False

            # Add query ID to response
            response_data['id'] = query_id
            response_data['timestamp'] = int(time.time() * 1000)

            # Send response back via response characteristic
            response_json = json.dumps(response_data)
            response_bytes = response_json.encode('utf-8')

            # Note: In a real implementation, you'd need to notify the client
            # that the response characteristic has been updated
            logger.info(f"📤 Response for query {query_id} ready: {response_data['text'][:50]}...")

        except Exception as e:
            logger.error(f"❌ Error handling query: {e}")
            self.is_processing = False

    async def handle_direct_query(self, prompt: str, context: Optional[str] = None) -> Dict[str, Any]:
        """Handle direct query for testing without BLE"""
        query_id = str(uuid.uuid4())[:8]
        logger.info(f"📥 Direct query {query_id}: {prompt[:50]}...")
        
        self.is_processing = True
        response_data = await self.query_ollama(prompt, context)
        self.is_processing = False
        
        response_data['id'] = query_id
        response_data['timestamp'] = int(time.time() * 1000)
        
        logger.info(f"📤 Response for query {query_id}: {response_data['text'][:100]}...")
        return response_data

    async def start_server(self):
        """Start the BLE server"""
        try:
            logger.info(f"🚀 Starting BLE server as '{self.device_name}'...")

            # Note: BleakGATTServer is not available in current bleak versions
            # This is a simplified implementation that simulates the server
            # For a full BLE server implementation, you would need to use:
            # - Linux: bluez with D-Bus API
            # - macOS: CoreBluetooth framework
            # - Windows: Windows.Devices.Bluetooth.Advertisement

            logger.info(f"📡 Simulating BLE server advertising as: {self.device_name}")
            logger.info(f"🤖 Serving model: {self.model_name}")
            logger.info(f"🔗 Service UUID: {LEAI_SERVICE_UUID}")
            logger.info(f"📝 Query Characteristic: {LEAI_QUERY_CHARACTERISTIC_UUID}")
            logger.info(f"📤 Response Characteristic: {LEAI_RESPONSE_CHARACTERISTIC_UUID}")
            logger.info(f"📊 Status Characteristic: {LEAI_STATUS_CHARACTERISTIC_UUID}")

            logger.info("⚠️  Note: This is a simulation. For full BLE server functionality,")
            logger.info("   you need to implement platform-specific BLE advertising.")
            logger.info("   The React Native app can still test the query processing logic.")
            
            # Test the Ollama connection with a simple query
            logger.info("🧪 Testing Ollama connection...")
            test_response = await self.handle_direct_query("Hello, can you respond?")
            if test_response.get('error'):
                logger.error(f"❌ Test query failed: {test_response['error']}")
            else:
                logger.info("✅ Test query successful - ready to serve!")

            # Simulate server running
            try:
                logger.info("🔄 Server running... Press Ctrl+C to stop")
                while True:
                    await asyncio.sleep(1)
                    # You could add periodic status checks here
            except KeyboardInterrupt:
                logger.info("🛑 Shutting down...")

        except Exception as e:
            logger.error(f"❌ Failed to start BLE server: {e}")
            raise

def main():
    parser = argparse.ArgumentParser(description="Ollama BLE Provider")
    parser.add_argument("--model", default="phi3", help="Ollama model to use")
    parser.add_argument("--device-name", default="Ollama Provider", help="BLE device name")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    parser.add_argument("--test-query", help="Run a single test query instead of starting server")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    logger.info("🔗 Ollama BLE Provider Starting...")
    logger.info(f"📱 Device Name: {args.device_name}")
    logger.info(f"🤖 Model: {args.model}")

    # Create the provider
    provider = OllamaBLEProvider(model_name=args.model, device_name=args.device_name)

    try:
        if args.test_query:
            # Run a single test query
            async def test_run():
                result = await provider.handle_direct_query(args.test_query)
                print(f"\nQuery: {args.test_query}")
                print(f"Response: {result['text']}")
                print(f"Model: {result['modelUsed']}")
                print(f"Time: {result['processingTime']:.0f}ms")
                print(f"Tokens: {result['tokensGenerated']}")
            
            asyncio.run(test_run())
        else:
            # Start the server
            asyncio.run(provider.start_server())
    except KeyboardInterrupt:
        logger.info("🛑 Provider stopped by user")
    except Exception as e:
        logger.error(f"❌ Provider failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

