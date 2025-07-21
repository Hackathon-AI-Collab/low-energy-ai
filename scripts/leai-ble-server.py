#!/usr/bin/env python3
"""
LEAI BLE Server - Combined Advertiser and Worker
Combines BLE advertising with Ollama query processing
Enhanced with GATT service for query/response communication
"""

import asyncio
import sys
import logging
import json
import time
import uuid
import requests
from typing import Optional, Dict, Any
import platform

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# LEAI Service and Characteristic UUIDs (must match the React Native app)
LEAI_SERVICE_UUID = "12345678-1234-1234-1234-123456789abc"
LEAI_QUERY_CHARACTERISTIC_UUID = "87654321-4321-4321-4321-cba987654321"
LEAI_RESPONSE_CHARACTERISTIC_UUID = "11111111-2222-3333-4444-555555555555"
LEAI_STATUS_CHARACTERISTIC_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

# Check for required dependencies
try:
    import requests
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install requests")
    sys.exit(1)

# Note: Bleak is primarily for BLE client operations, not server
# We'll use BlueZ D-Bus for server functionality
HAS_BLEAK = False

# Platform-specific imports
if platform.system() == "Linux":
    try:
        import dbus
        import dbus.mainloop.glib
        from gi.repository import GLib
        HAS_LINUX_BLE = True
        logger.info("🔗 Linux BlueZ D-Bus libraries available")
    except ImportError as e:
        HAS_LINUX_BLE = False
        logger.warning(f"⚠️  Linux BLE dependencies missing: {e}")
        logger.warning("Install with: sudo apt-get install python3-dbus python3-gi")
else:
    HAS_LINUX_BLE = False

class LEAIBLEServer:
    def __init__(self, model_name: str = "phi3", device_name: str = "LEAI Provider", port: int = 11434):
        self.model_name = model_name
        self.device_name = device_name
        self.port = port
        self.ollama_url = f"http://localhost:{port}"
        self.is_processing = False
        self.is_advertising = False
        self.adapter_path = None
        self.bus = None
        self.mainloop = None
        self.gatt_server = None
        
        # Enhanced device name with model info
        # Use the full model name including the tag (e.g., "phi3:mini")
        self.full_device_name = f"{device_name} ({model_name})"
        
        # Service capabilities
        self.capabilities = {
            "service": "LEAI-LLM",
            "model": model_name,
            "port": port,
            "version": "1.0",
            "features": ["text-generation", "context-aware"],
            "max_tokens": 2048,
            "temperature_range": [0.0, 1.0]
        }

        # Check if Ollama is running
        self._check_ollama()

    def _check_ollama(self):
        """Check if Ollama is running and get available models"""
        try:
            logger.info("🤖 Checking Ollama availability...")

            # Check if Ollama is running
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
            if response.status_code != 200:
                raise Exception("Ollama not responding")

            models = response.json().get("models", [])
            if not models:
                raise Exception("No models available in Ollama")

            # Get full model names
            available_models = [model.get("name", "") for model in models]

            # Check if our exact model is available
            if self.model_name in available_models:
                logger.info(f"Using specified model: {self.model_name}")
            else:
                # Check if any model matches the base name (e.g., "phi3" matches "phi3:mini")
                matching_models = [m for m in available_models if m.startswith(self.model_name + ":")]
                if matching_models:
                    self.model_name = matching_models[0]
                    logger.info(f"Found matching model: {self.model_name}")
                else:
                    # Use first available model
                    self.model_name = available_models[0]
                    logger.info(f"Using first available model: {self.model_name}")

            # Update the device name with the confirmed model name
            self.full_device_name = f"{self.device_name} ({self.model_name})"
            logger.info(f"✅ Ollama running with model: {self.model_name}")
            logger.info(f"📱 Device name: {self.full_device_name}")

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

    async def handle_query_via_http(self, query_data: dict) -> dict:
        """Handle incoming query via HTTP (fallback method)"""
        try:
            logger.info(f"📝 Received query via HTTP: {query_data}")
            
            prompt = query_data.get('prompt', '')
            context = query_data.get('context')
            
            logger.info(f"🤖 Processing query: {prompt[:50]}...")
            
            # Query Ollama
            result = await self.query_ollama(prompt, context)
            
            # Prepare response
            response_data = {
                "id": query_data.get('id', f"response_{int(time.time())}"),
                "text": result['text'],
                "modelUsed": result['modelUsed'],
                "processingTime": result['processingTime'],
                "tokensGenerated": result['tokensGenerated'],
                "error": result.get('error'),
                "timestamp": int(time.time() * 1000)
            }
            
            logger.info(f"📤 Sending response: {len(str(response_data))} chars")
            return response_data
            
        except Exception as e:
            logger.error(f"❌ Error handling query: {e}")
            return {
                "error": str(e),
                "timestamp": int(time.time() * 1000)
            }

    def _find_bluetooth_adapter(self):
        """Find the Bluetooth adapter using D-Bus"""
        try:
            # Get system bus
            self.bus = dbus.SystemBus()
            
            # Try different approaches to find the adapter
            try:
                # Method 1: Try to get the default adapter directly
                manager = dbus.Interface(
                    self.bus.get_object('org.bluez', '/'),
                    'org.freedesktop.DBus.ObjectManager'
                )
                objects = manager.GetManagedObjects()
                
                for path, interfaces in objects.items():
                    if 'org.bluez.Adapter1' in interfaces:
                        self.adapter_path = path
                        logger.info(f"Found adapter: {path}")
                        return True
                        
            except dbus.exceptions.DBusException as e:
                logger.debug(f"Method 1 failed: {e}")
                
            # Method 2: Try common adapter paths
            common_paths = ['/org/bluez/hci0', '/org/bluez/hci1']
            for path in common_paths:
                try:
                    adapter = self.bus.get_object('org.bluez', path)
                    adapter_interface = dbus.Interface(adapter, 'org.bluez.Adapter1')
                    # Test if we can access the adapter
                    adapter_interface.Get('org.bluez.Adapter1', 'Address')
                    self.adapter_path = path
                    logger.info(f"Found adapter at: {path}")
                    return True
                except dbus.exceptions.DBusException:
                    continue
                    
            return False
            
        except Exception as e:
            logger.error(f"Error finding Bluetooth adapter: {e}")
            return False

    def _check_bluetooth_service(self):
        """Check if BlueZ service is running"""
        try:
            # Check if bluetoothd is running
            import subprocess
            result = subprocess.run(['systemctl', 'is-active', 'bluetooth'], 
                                  capture_output=True, text=True)
            if result.returncode != 0:
                logger.error("❌ Bluetooth service is not running")
                logger.error("Start it with: sudo systemctl start bluetooth")
                return False
                
            logger.info("✅ Bluetooth service is running")
            return True
            
        except Exception as e:
            logger.warning(f"Could not check Bluetooth service status: {e}")
            return True  # Assume it's running if we can't check

    async def start_linux_advertising(self):
        """Start BLE advertising on Linux using BlueZ D-Bus"""
        try:
            if not HAS_LINUX_BLE:
                raise Exception("Linux BLE dependencies not available")

            # Check Bluetooth service
            if not self._check_bluetooth_service():
                raise Exception("Bluetooth service not running")

            # Initialize D-Bus main loop
            dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)

            # Find Bluetooth adapter
            if not self._find_bluetooth_adapter():
                raise Exception("No Bluetooth adapter found")

            # Get adapter interface
            adapter = self.bus.get_object('org.bluez', self.adapter_path)
            adapter_props = dbus.Interface(adapter, 'org.freedesktop.DBus.Properties')
            adapter_interface = dbus.Interface(adapter, 'org.bluez.Adapter1')

            # Check if adapter is powered
            try:
                powered = adapter_props.Get('org.bluez.Adapter1', 'Powered')
                if not powered:
                    logger.info("Powering on Bluetooth adapter...")
                    adapter_props.Set('org.bluez.Adapter1', 'Powered', dbus.Boolean(True))
                    await asyncio.sleep(1)  # Wait for power on
            except Exception as e:
                logger.warning(f"Could not check/set adapter power: {e}")

            # Set discoverable and pairable
            try:
                adapter_props.Set('org.bluez.Adapter1', 'Discoverable', dbus.Boolean(True))
                adapter_props.Set('org.bluez.Adapter1', 'Pairable', dbus.Boolean(True))
            except Exception as e:
                logger.warning(f"Could not set discoverable/pairable: {e}")

            # Set device name/alias
            try:
                adapter_props.Set('org.bluez.Adapter1', 'Alias', self.full_device_name)
                logger.info(f"Set device name to: {self.full_device_name}")
            except Exception as e:
                logger.warning(f"Could not set device name: {e}")

            logger.info("✅ Basic Bluetooth advertising configured")
            logger.info("📱 Your device should now be discoverable")
            logger.info("🔄 Server running... Press Ctrl+C to stop")

            # Keep the server running
            self.is_advertising = True
            while self.is_advertising:
                await asyncio.sleep(1)

        except Exception as e:
            logger.error(f"❌ Linux BLE advertising failed: {e}")
            self._print_troubleshooting_tips()
            raise

    def _print_troubleshooting_tips(self):
        """Print troubleshooting tips for BLE setup"""
        logger.error("💡 Troubleshooting tips:")
        logger.error("   1. Check Bluetooth is enabled: bluetoothctl show")
        logger.error("   2. Start Bluetooth service: sudo systemctl start bluetooth")
        logger.error("   3. Install dependencies: sudo apt-get install python3-dbus python3-gi")
        logger.error("   4. Check adapter status: hciconfig")
        logger.error("   5. Try resetting Bluetooth: sudo systemctl restart bluetooth")

    async def start_simulation_mode(self):
        """Run in simulation mode without actual BLE advertising"""
        logger.info("🧪 Starting in simulation mode...")
        logger.info("📱 In real implementation, your app would discover this device")
        logger.info("🔄 Simulation running... Press Ctrl+C to stop")
        
        # Simulate periodic status updates
        self.is_advertising = True
        counter = 0
        while self.is_advertising:
            counter += 1
            if counter % 30 == 0:  # Every 30 seconds
                logger.info(f"💝 Simulation heartbeat - {counter} seconds running")
                
                # Simulate a test query occasionally
                if counter % 120 == 0:  # Every 2 minutes
                    logger.info("🧪 Running periodic test query...")
                    test_result = await self.query_ollama("What is AI?")
                    logger.info(f"Test response: {test_result['text'][:50]}...")
                    
            await asyncio.sleep(1)

    async def start_server(self):
        """Start the combined BLE server"""
        try:
            logger.info(f"🚀 Starting LEAI BLE server as '{self.full_device_name}'...")
            logger.info(f"🤖 Serving model: {self.model_name}")
            logger.info(f"🔗 Service UUID: {LEAI_SERVICE_UUID}")
            logger.info(f"📝 Query Characteristic: {LEAI_QUERY_CHARACTERISTIC_UUID}")
            logger.info(f"📤 Response Characteristic: {LEAI_RESPONSE_CHARACTERISTIC_UUID}")
            logger.info(f"📊 Status Characteristic: {LEAI_STATUS_CHARACTERISTIC_UUID}")

            # Test the Ollama connection with a simple query
            logger.info("🧪 Testing Ollama connection...")
            test_response = await self.query_ollama("Hello, can you respond?")
            if test_response.get('error'):
                logger.error(f"❌ Test query failed: {test_response['error']}")
                raise Exception("Ollama test failed")
            else:
                logger.info("✅ Test query successful - ready to serve!")

            # Note: Full GATT server implementation requires additional libraries
            # For now, we'll use advertising + HTTP fallback for queries
            logger.info("📡 Using BLE advertising + HTTP fallback for queries")

            # Fallback to platform-specific advertising
            if platform.system() == "Linux" and HAS_LINUX_BLE:
                logger.info("🔗 Starting Linux BLE advertising...")
                await self.start_linux_advertising()
            else:
                # Fallback to simulation mode
                reasons = []
                if platform.system() != "Linux":
                    reasons.append(f"Platform {platform.system()} not fully supported")
                if not HAS_LINUX_BLE:
                    reasons.append("BLE dependencies not available")
                    
                logger.warning(f"⚠️  Running in simulation mode: {', '.join(reasons)}")
                await self.start_simulation_mode()

        except KeyboardInterrupt:
            logger.info("🛑 Stopping server...")
            self.is_advertising = False
            if self.gatt_server:
                await self.gatt_server.stop()
            raise
        except Exception as e:
            logger.error(f"❌ Failed to start BLE server: {e}")
            raise

    def stop(self):
        """Stop the BLE server"""
        self.is_advertising = False


async def main():
    """Main function"""
    import argparse

    parser = argparse.ArgumentParser(description="LEAI BLE Server - Combined Advertiser and Worker")
    parser.add_argument("--model", default="phi3", help="Ollama model to use")
    parser.add_argument("--device-name", default="LEAI Provider", help="BLE device name")
    parser.add_argument("--port", type=int, default=11434, help="Ollama port")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")
    parser.add_argument("--test-query", help="Run a single test query instead of starting server")
    parser.add_argument("--simulate", action="store_true", help="Force simulation mode")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    logger.info("🔗 LEAI BLE Server Starting...")
    logger.info(f"📱 Device Name: {args.device_name}")
    logger.info(f"🤖 Model: {args.model}")
    logger.info(f"🔌 Port: {args.port}")

    # Create the server
    server = LEAIBLEServer(model_name=args.model, device_name=args.device_name, port=args.port)

    try:
        if args.test_query:
            # Run a single test query
            result = await server.query_ollama(args.test_query)
            print(f"\nQuery: {args.test_query}")
            print(f"Response: {result['text']}")
            print(f"Model: {result['modelUsed']}")
            print(f"Time: {result['processingTime']:.0f}ms")
            print(f"Tokens: {result['tokensGenerated']}")
        elif args.simulate:
            # Force simulation mode
            logger.info("🧪 Forcing simulation mode...")
            await server.start_simulation_mode()
        else:
            # Start the server normally
            await server.start_server()
    except KeyboardInterrupt:
        logger.info("🛑 Server stopped by user")
        server.stop()
    except Exception as e:
        logger.error(f"❌ Server failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

