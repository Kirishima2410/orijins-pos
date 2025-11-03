#!/bin/bash

echo "Starting Coffee Shop POS System..."
echo

echo "Installing dependencies..."
npm run install-all

echo
echo "Starting the application..."
echo "Backend will run on http://localhost:5000"
echo "Frontend will run on http://localhost:3000"
echo

# Start backend in background
cd backend && npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend in background
cd ../frontend && npm start &
FRONTEND_PID=$!

echo
echo "Application started successfully!"
echo
echo "Customer Interface: http://localhost:3000"
echo "Staff Portal: http://localhost:3000/staff/login"
echo
echo "Default login credentials:"
echo "Owner/Admin: admin / admin123"
echo "Cashier: cashier / cashier123"
echo

# Function to cleanup on exit
cleanup() {
    echo "Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

# Trap Ctrl+C
trap cleanup SIGINT

# Wait for user to stop
echo "Press Ctrl+C to stop the servers"
wait
