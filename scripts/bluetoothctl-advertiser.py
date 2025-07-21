#!/usr/bin/env python3
"""
Bluetoothctl BLE Advertiser for LEAI
Uses bluetoothctl commands to properly advertise the device
"""

import asyncio
import sys
import logging
import subprocess
import signal
import time
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BluetoothctlAdvertiser:
    def __init__(self, device_name: str = "LEAI-Phi3"):
        self.device_name = device_name
        self.is_advertising = False

    def _run_bluetoothctl_command(self, command):
        """Run a bluetoothctl command and return the result"""
        try:
            # Use echo to send command to bluetoothctl
            full_command = f'echo "{command}" | bluetoothctl'
            result = subprocess.run(
                full_command, 
                shell=True, 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                logger.warning(f"Command failed: {command}")
                logger.warning(f"Error: {result.stderr}")
                return None
        except subprocess.TimeoutExpired:
            logger.error(f"Command timed out: {command}")
            return None
        except Exception as e:
            logger.error(f"Command error: {command} - {e}")
            return None

    def _run_bluetoothctl_script(self, commands):
        """Run multiple bluetoothctl commands as a script"""
        try:
            # Create a temporary script file
            script_content = "\n".join(commands)
            
            # Write to a temporary file
            script_file = "/tmp/ble_advertise_script.txt"
            with open(script_file, 'w') as f:
                f.write(script_content)
            
            # Run bluetoothctl with the script
            result = subprocess.run(
                f'bluetoothctl < {script_file}',
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Clean up
            os.remove(script_file)
            
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                logger.warning(f"Script failed")
                logger.warning(f"Error: {result.stderr}")
                return None
                
        except Exception as e:
            logger.error(f"Script error: {e}")
            return None

    async def start_advertising(self):
        """Start BLE advertising using bluetoothctl"""
        try:
            logger.info("🔗 Bluetoothctl BLE Advertiser Starting...")
            logger.info(f"📱 Device Name: {self.device_name}")

            # Create bluetoothctl script
            commands = [
                "power on",
                f"set-alias '{self.device_name}'",
                "discoverable on",
                "pairable on",
                "advertising on", ERROR  Warning: Encountered two children with the same key, `.$ready`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.

  28 |
  29 | export default function ChatScreen() {
> 30 |   const [messages, setMessages] = useState<Message[]>([]);
     |                                           ^
  31 |   const [inputText, setInputText] = useState('');
  32 |   const [isLoading, setIsLoading] = useState(false);
  33 |   const [advancedRAG, setAdvancedRAG] = useState<any>(null);

Call Stack

                "quit"
            ]

            logger.info("📡 Running bluetoothctl advertising script...")
            result = self._run_bluetoothctl_script(commands)
            
            if result:
                logger.info("✅ Bluetoothctl advertising script completed")
                logger.info(f"📱 Device: {self.device_name}")
                logger.info("🔄 Server running... Press Ctrl+C to stop")
            else:
                logger.warning("⚠️  Bluetoothctl script may have failed, but continuing...")

            # Keep the server running
            self.is_advertising = True
            while self.is_advertising:
                await asyncio.sleep(5)
                # Keep advertising alive
                self._run_bluetoothctl_command("advertising on")

        except Exception as e:
            logger.error(f"❌ Bluetoothctl BLE advertising failed: {e}")
            raise

    def stop(self):
        """Stop the BLE advertiser"""
        self.is_advertising = False
        logger.info("🛑 Stopping BLE advertising...")
        
        # Stop advertising
        commands = [
            "advertising off",
            "discoverable off",
            "quit"
        ]
        self._run_bluetoothctl_script(commands)
        
        logger.info("✅ BLE advertising stopped")


async def main():
    """Main function"""
    import argparse

    parser = argparse.ArgumentParser(description="Bluetoothctl BLE Advertiser for LEAI")
    parser.add_argument("--device-name", default="LEAI-Phi3", help="BLE device name")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose logging")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Create the advertiser
    advertiser = BluetoothctlAdvertiser(device_name=args.device_name)

    # Setup signal handlers
    def signal_handler(signum, frame):
        logger.info("🛑 Received signal, stopping advertiser...")
        advertiser.stop()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        await advertiser.start_advertising()
    except KeyboardInterrupt:
        logger.info("🛑 Advertiser stopped by user")
        advertiser.stop()
    except Exception as e:
        logger.error(f"❌ Advertiser failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main()) 