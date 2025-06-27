#!/bin/bash

echo "Testing TypeScript compilation..."
cd /Users/dykim/dev/auto-dev-system/modules/atc-dashboard

# Run TypeScript compiler check
echo "Running tsc --noEmit..."
npx tsc --noEmit

# Check exit code
if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful!"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

echo "Done!"