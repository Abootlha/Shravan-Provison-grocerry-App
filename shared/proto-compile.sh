#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Compiling proto files..."
node compile-protos.js

echo "Proto files compiled successfully!"
