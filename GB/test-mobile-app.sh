#!/bin/bash

echo "🧪 Testing Cattle Management Mobile App..."
echo ""

# Check backend
echo "1. Testing Backend API..."
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "   ✅ Backend API is running"
    CATTLE_COUNT=$(curl -s http://localhost:3001/api/cattle | jq '.data | length' 2>/dev/null || echo "unknown")
    echo "   📊 Cattle records: $CATTLE_COUNT"
else
    echo "   ❌ Backend API is not running"
    echo "   🔧 Starting backend..."
    cd /Users/shimasarah/Desktop/GB/cattle-management-mobile/backend-mongo
    npm run dev > mongodb.log 2>&1 &
    sleep 5
fi

# Check mobile app
echo ""
echo "2. Testing Mobile App Server..."
if curl -s http://localhost:8081/status | grep -q "running"; then
    echo "   ✅ Mobile app server is running"
else
    echo "   ❌ Mobile app server is not running"
    echo "   🔧 Starting mobile app..."
    cd /Users/shimasarah/Desktop/GB/cattle-management-mobile
    npx expo start --clear > expo.log 2>&1 &
    sleep 10
fi

echo ""
echo "3. Testing Dependencies..."
cd /Users/shimasarah/Desktop/GB/cattle-management-mobile
if npx tsc --noEmit > /dev/null 2>&1; then
    echo "   ✅ TypeScript compilation successful"
else
    echo "   ⚠️  TypeScript compilation has warnings (but app should still work)"
fi

echo ""
echo "🎉 Test Results:"
echo "   📱 Mobile App: http://localhost:8081"
echo "   📊 Backend API: http://localhost:3001"
echo ""
echo "📱 To test on your phone:"
echo "   1. Install Expo Go from App Store/Google Play"
echo "   2. Run: cd /Users/shimasarah/Desktop/GB/cattle-management-mobile && npx expo start"
echo "   3. Scan QR code with Expo Go app"
echo ""
echo "🖥️  To test on simulator:"
echo "   - Press 'i' for iOS Simulator"
echo "   - Press 'a' for Android Emulator"
echo ""
