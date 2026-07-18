#!/bin/bash

echo "🐄 Starting Cattle Management System..."

# Start MongoDB Backend
echo "📊 Starting MongoDB Backend..."
cd /Users/shimasarah/Desktop/GB/cattle-management-mobile/backend-mongo
npm run dev > mongodb.log 2>&1 &
MONGO_PID=$!

# Wait for backend to start
sleep 3

# Test backend
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ MongoDB Backend running on http://localhost:3001"
else
    echo "❌ MongoDB Backend failed to start"
    exit 1
fi

# Start Web Frontend
echo "🌐 Starting Web Frontend..."
cd /Users/shimasarah/Desktop/GB/frontend
npm start > frontend.log 2>&1 &
WEB_PID=$!

# Start Mobile App
echo "📱 Starting Mobile App..."
cd /Users/shimasarah/Desktop/GB/cattle-management-mobile
npx expo start > expo.log 2>&1 &
EXPO_PID=$!

echo ""
echo "🎉 Cattle Management System Started!"
echo ""
echo "📊 Backend API: http://localhost:3001"
echo "🌐 Web App: http://localhost:3000"
echo "📱 Mobile App: Follow Expo CLI instructions"
echo ""
echo "To stop all services, run: kill $MONGO_PID $WEB_PID $EXPO_PID"
echo ""
echo "📱 Mobile App Options:"
echo "  - Press 'i' for iOS Simulator"
echo "  - Press 'a' for Android Emulator"
echo "  - Press 'w' for Web Browser"
echo "  - Scan QR code with Expo Go app on your phone"
echo ""
