const { execSync } = require('child_process');

try {
  // Try to compile TypeScript
  console.log('Checking TypeScript compilation...');
  execSync('npx tsc --noEmit', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  console.log('✅ TypeScript compilation successful!');
} catch (error) {
  console.log('❌ TypeScript compilation failed');
  process.exit(1);
}

try {
  // Try to run ESLint if available
  console.log('\nChecking ESLint...');
  execSync('npx eslint src/components/RadarDisplay.tsx', { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  console.log('✅ ESLint check passed!');
} catch (error) {
  console.log('⚠️  ESLint check failed or not configured');
}

console.log('\n✨ All checks completed!');