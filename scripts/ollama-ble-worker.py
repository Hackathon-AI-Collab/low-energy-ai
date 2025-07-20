#!/usr/bin/env python3
"""
Ollama BLE Provider Script
Provides Ollama LLM service over Bluetooth Low Energy

Usage:
    python3 ollama-ble-worker.py [--model phi3] [--device-name "My Laptop"]

Requirements:
    pip install bleak asyncio requests
    ollama serve (running in background)
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
    from bleak import BleakServer, BleakGATTService, BleakGATTCharacteristic
    import requests
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install bleak requests")
    sys.exit(1)

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
        self.server: Optional[BleakServer] = None
        
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
    
    async def start_server(self):
        """Start the BLE server"""
        try:
            logger.info(f"🚀 Starting BLE server as '{self.device_name}'...")
            
            # Create the LEAI service
            leai_service = BleakGATTService(
                uuid=LEAI_SERVICE_UUID,
                primary=True
            )
            
            # Create characteristics
            query_char = BleakGATTCharacteristic(
                uuid=LEAI_QUERY_CHARACTERISTIC_UUID,
                service_uuid=LEAI_SERVICE_UUID,
                properties=["write", "write-without-response"],
                value=None,
                descriptors=[]
            )
            
            response_char = BleakGATTCharacteristic(
                uuid=LEAI_RESPONSE_CHARACTERISTIC_UUID,
                service_uuid=LEAI_SERVICE_UUID,
                properties=["read", "notify"],
                value=None,
                descriptors=[]
            )
            
            status_char = BleakGATTCharacteristic(
                uuid=LEAI_STATUS_CHARACTERISTIC_UUID,
                service_uuid=LEAI_SERVICE_UUID,
                properties=["read", "notify"],
                value=json.dumps({
                    "status": "available",
                    "model": self.model_name,
                    "device_name": self.device_name
                }).encode('utf-8'),
                descriptors=[]
            )
            
            # Add characteristics to service
            leai_service.characteristics = [query_char, response_char, status_char]
            
            # Create server
            self.server = BleakServer(
                services=[leai_service],
                name=self.device_name
            )
            
            # Set up characteristic handlers
            @self.server.characteristic_write_handler(LEAI_QUERY_CHARACTERISTIC_UUID)
            async def handle_query_write(characteristic, data):
                await self.handle_query_characteristic_write(characteristic, data)
            
            # Start the server
            await self.server.start()
            logger.info(f"✅ BLE server started successfully")
            logger.info(f"📡 Advertising as: {self.device_name}")
            logger.info(f"🤖 Serving model: {self.model_name}")
            logger.info(f"🔗 Service UUID: {LEAI_SERVICE_UUID}")
            
            # Keep the server running
            try:
                while True:
                    await asyncio.sleep(1)
            except KeyboardInterrupt:
                logger.info("🛑 Shutting down...")
                await self.server.stop()
                
        except Exception as e:
            logger.error(f"❌ Failed to start BLE server: {e}")
            raise

def main():
    parser = argparse.ArgumentParser(description="Ollama BLE Provider")
    parser.add_argument("--model", default="phi3", help="Ollama model to use")
    parser.add_argument("--device-name", default="Ollama Provider", help="BLE device name")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    logger.info("🔗 Ollama BLE Provider Starting...")
    logger.info(f"📱 Device Name: {args.device_name}")
    logger.info(f"🤖 Model: {args.model}")
    
    # Create and start the provider
    provider = OllamaBLEProvider(model_name=args.model, device_name=args.device_name)
    
    try:
        asyncio.run(provider.start_server())
    except KeyboardInterrupt:
        logger.info("🛑 Provider stopped by user")
    except Exception as e:
        logger.error(f"❌ Provider failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 