# Clear React build cache
Write-Host "Clearing React build cache..."

# Remove build folder
if (Test-Path "build") {
    Remove-Item -Recurse -Force "build"
    Write-Host "✓ Build folder removed"
}

# Remove node_modules cache
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache"
    Write-Host "✓ Node modules cache cleared"
}

# Remove ESLint cache
if (Test-Path ".eslintcache") {
    Remove-Item -Force ".eslintcache"
    Write-Host "✓ ESLint cache cleared"
}

Write-Host ""
Write-Host "Cache cleared! Now restart your dev server with: npm start"
Write-Host ""

