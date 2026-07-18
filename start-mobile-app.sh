#!/bin/bash

echo "🐄 Starting Cattle Management Mobile App..."

# Check if MongoDB backend is running
if ! curl -s http://localhost:3001/api/health > /dev/null; then
    echo "📊 Starting MongoDB Backend..."
    cd /Users/shimasarah/Desktop/GB/cattle-management-mobile/backend-mongo
    npm run dev > mongodb.log 2>&1 &
    MONGO_PID=$!
    
    # Wait for backend to start
    echo "⏳ Waiting for backend to start..."
    sleep 5
    
    if curl -s http://localhost:3001/api/health > /dev/null; then
        echo "✅ MongoDB Backend running on http://localhost:3001"
    else
        echo "❌ MongoDB Backend failed to start"
        exit 1
    fi
else
    echo "✅ MongoDB Backend already running"
fi

# Start Mobile App
echo "📱 Starting Mobile App..."
cd /Users/shimasarah/Desktop/GB/cattle-management-mobile

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start Expo
echo "🚀 Starting Expo development server..."
npx expo start --clear

echo ""
echo "🎉 Mobile App Started!"
echo ""
echo "📱 Mobile App Options:"
echo "  - Press 'i' for iOS Simulator (requires Xcode)"
echo "  - Press 'a' for Android Emulator (requires Android Studio)"
echo "  - Press 'w' for Web Browser"
echo "  - Scan QR code with Expo Go app on your phone"
echo ""
echo "📊 Backend API: http://localhost:3001"
echo ""
echo "📱 To install Expo Go on your phone:"
echo "  - iOS: https://apps.apple.com/app/expo-go/id982107779"
echo "  - Android: https://play.google.com/store/apps/details?id=host.exp.exponent"
echo ""
