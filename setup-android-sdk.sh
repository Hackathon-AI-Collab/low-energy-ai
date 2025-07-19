#!/bin/bash

# Android SDK Setup Script for Local Development Builds
echo "🚀 Setting up Android SDK for local development builds..."

# Create Android SDK directory
ANDROID_HOME="$HOME/Android/Sdk"
mkdir -p "$ANDROID_HOME"

echo "📁 Android SDK will be installed to: $ANDROID_HOME"

# Download command line tools
echo "📥 Downloading Android Command Line Tools..."
cd /tmp
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip

# Extract command line tools
echo "📦 Extracting command line tools..."
unzip commandlinetools-linux-11076708_latest.zip -d "$ANDROID_HOME"

# Set up environment variables
echo "🔧 Setting up environment variables..."
echo "export ANDROID_HOME=$ANDROID_HOME" >> ~/.bashrc
echo "export PATH=\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin" >> ~/.bashrc
echo "export PATH=\$PATH:\$ANDROID_HOME/platform-tools" >> ~/.bashrc
echo "export PATH=\$PATH:\$ANDROID_HOME/emulator" >> ~/.bashrc

# Source the updated profile
source ~/.bashrc

echo "✅ Android SDK setup complete!"
echo "📱 Next steps:"
echo "1. Restart your terminal or run: source ~/.bashrc"
echo "2. Run: sdkmanager --list"
echo "3. Install required packages:"
echo "   sdkmanager 'platform-tools' 'platforms;android-34' 'build-tools;34.0.0' 'system-images;android-34;google_apis;x86_64'"
echo "4. Create an emulator:"
echo "   avdmanager create avd -n test_device -k 'system-images;android-34;google_apis;x86_64'"
echo "5. Start the emulator:"
echo "   emulator -avd test_device"
echo "6. Run your app:"
echo "   npx expo run:android" 