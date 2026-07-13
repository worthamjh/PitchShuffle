#!/bin/sh
set -ex

# Install node and npm dependencies
brew install node
cd "$CI_WORKSPACE"
npm install

# Resolve Swift packages from CapApp-SPM directory
cd "$CI_WORKSPACE/ios/App/CapApp-SPM"
swift package resolve

# Copy resolved file to where Xcode expects it
mkdir -p "$CI_WORKSPACE/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm"
cp Package.resolved "$CI_WORKSPACE/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved"
