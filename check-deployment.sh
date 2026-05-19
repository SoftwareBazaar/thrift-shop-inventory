#!/bin/bash

# Diagnostic script to verify what's being deployed to Vercel

echo "========================================="
echo "VERCEL DEPLOYMENT DIAGNOSTIC"
echo "========================================="
echo ""

echo "1. Checking .vercelignore file:"
echo "-----------------------------------"
cat .vercelignore
echo ""

echo "2. Checking if API files exist:"
echo "-----------------------------------"
if [ -f "api/auth/send-verification-email.js" ]; then
    echo "✅ api/auth/send-verification-email.js EXISTS"
else
    echo "❌ api/auth/send-verification-email.js MISSING"
fi

if [ -f "api/auth/verify-code.js" ]; then
    echo "✅ api/auth/verify-code.js EXISTS"
else
    echo "❌ api/auth/verify-code.js MISSING"
fi

if [ -f "api/auth/recover-password.js" ]; then
    echo "✅ api/auth/recover-password.js EXISTS"
else
    echo "❌ api/auth/recover-password.js MISSING"
fi

echo ""
echo "3. Checking git status:"
echo "-----------------------------------"
git status --short

echo ""
echo "4. Checking recent commits:"
echo "-----------------------------------"
git log --oneline -5

echo ""
echo "5. Checking if .vercelignore has 'api/' line:"
echo "-----------------------------------"
if grep -q "^api/$" .vercelignore; then
    echo "❌ PROBLEM: .vercelignore still contains 'api/' - API files won't deploy!"
else
    echo "✅ GOOD: .vercelignore does NOT contain 'api/' line"
fi

echo ""
echo "========================================="
echo "RECOMMENDATION:"
echo "========================================="
echo "If .vercelignore still contains 'api/', run:"
echo "  git add .vercelignore"
echo "  git commit -m 'Fix: Remove api/ from .vercelignore'"
echo "  git push"
echo ""
