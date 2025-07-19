#!/bin/bash

# Android Development Build Script with ONNX Runtime Testing
# This script sets up the environment and builds the app for testing real ONNX Runtime

set -e  # Exit on any error

echo "🚀 Starting Android Development Build with ONNX Runtime Testing..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Check and set up environment variables
print_status "Step 1: Setting up environment variables..."

# Set Android SDK path
export ANDROID_HOME=/opt/android-sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools/bin

# Set Java 17 for compatibility
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export PATH=$JAVA_HOME/bin:$PATH

print_success "Environment variables set"

# Step 2: Verify Java version
print_status "Step 2: Verifying Java version..."
java_version=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2)
print_status "Using Java version: $java_version"

if [[ $java_version == 17* ]]; then
    print_success "Java 17 detected - compatible with Gradle"
else
    print_warning "Java version $java_version detected - may cause build issues"
fi

# Step 3: Check Android SDK
print_status "Step 3: Checking Android SDK..."
if [ -d "$ANDROID_HOME" ]; then
    print_success "Android SDK found at: $ANDROID_HOME"
else
    print_error "Android SDK not found at $ANDROID_HOME"
    exit 1
fi

# Step 4: Check ADB and connected devices
print_status "Step 4: Checking ADB and connected devices..."
adb_path=$(which adb)
if [ -n "$adb_path" ]; then
    print_success "ADB found at: $adb_path"
else
    print_error "ADB not found in PATH"
    exit 1
fi

# Check for connected devices
print_status "Checking for connected Android devices..."
adb devices | while read line; do
    if [[ $line == *"device"* ]] && [[ $line != *"List of devices"* ]]; then
        device_id=$(echo $line | awk '{print $1}')
        print_success "Found connected device: $device_id"
    fi
done

# Step 5: Check Node.js and dependencies
print_status "Step 5: Checking Node.js and dependencies..."
node_version=$(node --version)
print_status "Node.js version: $node_version"

# Check if bun is available
if command -v bun &> /dev/null; then
    print_success "Bun package manager found"
    PACKAGE_MANAGER="bun"
else
    print_warning "Bun not found, using npm"
    PACKAGE_MANAGER="npm"
fi

# Step 6: Install dependencies
print_status "Step 6: Installing dependencies..."
if [ "$PACKAGE_MANAGER" = "bun" ]; then
    bun install
else
    npm install
fi

# Step 7: Check ONNX Runtime package
print_status "Step 7: Checking ONNX Runtime package..."
if [ -d "node_modules/onnxruntime-react-native" ]; then
    print_success "ONNX Runtime React Native package found"
else
    print_error "ONNX Runtime React Native package not found"
    print_status "Installing onnxruntime-react-native..."
    if [ "$PACKAGE_MANAGER" = "bun" ]; then
        bun add onnxruntime-react-native
    else
        npm install onnxruntime-react-native
    fi
fi

# Step 8: Prebuild the project
print_status "Step 8: Running Expo prebuild..."
npx expo prebuild --platform android --clean

# Step 9: Fix Android SDK permissions if needed
print_status "Step 9: Checking Android SDK permissions..."
if [ ! -w "$ANDROID_HOME" ]; then
    print_warning "Android SDK directory not writable, attempting to fix permissions..."
    sudo chown -R $USER:$USER $ANDROID_HOME
    print_success "Android SDK permissions fixed"
fi

# Step 10: Build the app
print_status "Step 10: Building Android app..."
print_status "This may take several minutes on first build..."

# Set environment variables for the build
export ANDROID_HOME=/opt/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export PATH=$JAVA_HOME/bin:$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools/bin

# Run the build
npx expo run:android

# Step 11: Test ONNX Runtime functionality
print_status "Step 11: Testing ONNX Runtime functionality..."
print_status "The app should now be installed on your device."
print_status "Please test the following:"
echo ""
echo "1. Open the app on your device"
echo "2. Go to Settings → Model Download"
echo "3. Download 'Xenova/all-MiniLM-L6-v2 (Sentence Transformer)'"
echo "4. Go to Settings → Sentence Transformer Model Selection"
echo "5. Select the downloaded model"
echo "6. Test chat functionality"
echo ""
echo "Expected behavior:"
echo "- Sentence transformer should use real ONNX Runtime"
echo "- LLM should use simulated ONNX mode (since no real LLM model is available)"
echo "- Check logs for ONNX Runtime status messages"
echo ""

print_success "Build script completed!"
print_status "Check the logs above for any errors or warnings."
print_status "If the build was successful, the app should be installed on your device." 