const { execSync } = require('child_process');
const path = require('path');

console.log('Checking TypeScript errors in atc-dashboard...\n');

try {
  // Change to the project directory
  process.chdir(__dirname);
  
  // Run TypeScript compiler with no emit
  console.log('Running TypeScript compiler check...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  
  console.log('\n✅ No TypeScript errors found!');
} catch (error) {
  console.log('\n❌ TypeScript compilation errors detected.');
  console.log('Please fix the errors shown above.');
  process.exit(1);
}