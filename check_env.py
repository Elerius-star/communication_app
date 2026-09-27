#!/usr/bin/env python3
"""
Environment Check Script
Run: python check_env.py
"""

import os
import sys
from dotenv import load_dotenv

def check_environment():
    """Check if .env file is correctly configured"""
    
    print("=" * 60)
    print("🔍 Checking .env Configuration")
    print("=" * 60)
    
    # Load .env file
    load_dotenv()
    
    # Check required variables
    required = [
        'SECRET_KEY',
        'JWT_SECRET_KEY', 
        'ENCRYPTION_KEY',
        'FRONTEND_URL',
        'BACKEND_URL',
        'CORS_ORIGINS'
    ]
    
    issues = []
    warnings = []
    
    print("\n📋 Checking required variables...")
    for var in required:
        value = os.getenv(var)
        if value:
            print(f"✅ {var}: {value[:20]}..." if len(value) > 20 else f"✅ {var}: {value}")
        else:
            print(f"❌ {var}: MISSING")
            issues.append(var)
    
    # Check Flask environment
    print("\n🔧 Checking environment settings...")
    flask_env = os.getenv('FLASK_ENV', 'not set')
    debug = os.getenv('DEBUG', 'False')
    
    if flask_env == 'production':
        warnings.append("FLASK_ENV is 'production' - Change to 'development' for local testing")
    print(f"📌 FLASK_ENV: {flask_env}")
    print(f"📌 DEBUG: {debug}")
    
    # Check database connections
    print("\n🗄️ Checking database configuration...")
    mongo_host = os.getenv('MONGO_HOST', 'localhost')
    redis_host = os.getenv('REDIS_HOST', 'localhost')
    
    if mongo_host == 'mongodb':
        warnings.append("MONGO_HOST is 'mongodb' - Change to 'localhost' for local development")
    if redis_host == 'redis':
        warnings.append("REDIS_HOST is 'redis' - Change to 'localhost' for local development")
    
    print(f"📌 MONGO_HOST: {mongo_host}")
    print(f"📌 REDIS_HOST: {redis_host}")
    
    # Check TURN configuration
    print("\n🌐 Checking TURN configuration...")
    turn_ip = os.getenv('TURN_IP', 'not set')
    turn_realm = os.getenv('TURN_REALM', 'not set')
    
    if turn_ip == '129.205.124.205':
        warnings.append("TURN_IP is your public IP - Use '127.0.0.1' for local testing")
    print(f"📌 TURN_IP: {turn_ip}")
    print(f"📌 TURN_REALM: {turn_realm}")
    
    # Check CORS origins
    print("\n🔗 Checking CORS configuration...")
    cors_origins = os.getenv('CORS_ORIGINS', '').split(',')
    print(f"📌 CORS_ORIGINS: {len(cors_origins)} origins configured")
    for origin in cors_origins:
        print(f"   - {origin.strip()}")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    
    if issues:
        print(f"❌ CRITICAL ISSUES: {len(issues)}")
        for issue in issues:
            print(f"   - {issue} is missing")
    else:
        print("✅ All required variables are present")
    
    if warnings:
        print(f"⚠️  WARNINGS: {len(warnings)}")
        for warning in warnings:
            print(f"   - {warning}")
    else:
        print("✅ No warnings")
    
    if not issues and not warnings:
        print("🎉 Your .env file is PERFECT for local development!")
    elif not issues and warnings:
        print("ℹ️  Your .env file will work but has some non-critical issues.")
    else:
        print("❌ Please fix the critical issues before running the application.")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    check_environment()