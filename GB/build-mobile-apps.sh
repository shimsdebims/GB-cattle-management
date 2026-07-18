#!/bin/bash

echo "📱 Building Cattle Management Mobile Apps..."
echo ""

cd /Users/shimasarah/Desktop/GB/cattle-management-mobile

echo "🔧 Step 1: Setting up build environment..."

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "Installing EAS CLI..."
    npm install -g eas-cli
fi

echo ""
echo "🏗️  Step 2: Building Android APK..."
echo ""
echo "To build the Android APK, you'll need to:"
echo "1. Create a free Expo account at https://expo.dev"
echo "2. Run: eas login"
echo "3. Run: eas build --platform android --profile preview"
echo ""
echo "This will create an APK file that you can:"
echo "✅ Send via email/WhatsApp/Google Drive"
echo "✅ Install directly on Android devices"
echo "✅ Share with anyone without app stores"
echo ""

echo "🍎 Step 3: Building iOS IPA..."
echo ""
echo "For iOS, you'll need:"
echo "1. Apple Developer Account ($99/year)"
echo "2. Run: eas build --platform ios --profile preview"
echo "3. Use TestFlight for distribution"
echo ""

echo "🌐 Alternative: Web App Distribution"
echo ""
echo "You can also deploy as a web app that works on all devices:"
echo "1. Run: npx expo export:web"
echo "2. Deploy to Netlify/Vercel/Firebase"
echo "3. Share the web link - works on any device!"
echo ""

echo "📱 Quick Test Options:"
echo ""
echo "Option A - Expo Go (Easiest):"
echo "  1. Run: npx expo start --tunnel"
echo "  2. Share QR code with users"
echo "  3. They scan with Expo Go app"
echo ""
echo "Option B - Local Network:"
echo "  1. Run: npx expo start"
echo "  2. Users on same WiFi scan QR code"
echo ""
echo "Option C - Web Version:"
echo "  1. Run: npx expo start --web"
echo "  2. Share the localhost URL"
echo ""

echo "🎯 Recommended for Distribution:"
echo "  • Android: Build APK with EAS"
echo "  • iOS: Use TestFlight or Expo Go"
echo "  • Universal: Deploy as web app"
echo ""
