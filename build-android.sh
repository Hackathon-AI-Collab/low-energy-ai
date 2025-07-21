#!/bin/bash

# Android Development Build Script for LEAI Platform
# This script ensures the correct environment and lets Gradle manage the NDK.

set -e

echo "🚀 Starting Android Development Build for LEAI Platform..."

# --- Colors and print functions ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# --- Step 1: Environment Setup ---
print_status "Step 1: Setting up environment variables..."
export ANDROID_HOME=/opt/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/tools/bin:$ANDROID_HOME/platform-tools
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export PATH=$JAVA_HOME/bin:$PATH
print_success "Environment variables set."

# --- Step 2: Generate Native Project (if needed) ---
if [ ! -d "android" ]; then
  print_warning "Android directory not found. Running prebuild to generate it."
  npx expo prebuild --platform android
  print_success "Native project generated."
fi

# --- Step 3: Clean Up Old NDK Configuration ---
print_status "Step 3: Removing custom NDK configuration to let Gradle manage it..."
PROPERTIES_FILE="android/local.properties"
if [ -f "$PROPERTIES_FILE" ]; then
    # Remove the line specifying the ndk.dir
    sed -i '/ndk.dir/d' "$PROPERTIES_FILE"
    print_success "Removed custom ndk.dir from $PROPERTIES_FILE."
fi

# --- Step 4: Dependency Installation ---
print_status "Step 4: Installing dependencies..."
bun install

# --- Step 5: Clear Metro Cache ---
print_status "Step 5: Clearing Metro cache for fresh document loading..."
rm -rf node_modules/.cache
print_success "Metro cache cleared."

# --- Step 6: Build and Run ---
print_status "Step 6: Building and running the Android app with document loading fixes..."

npx expo run:android

print_success "Build script completed!"
print_status "If the build was successful, the app should be installed and running on your device."
