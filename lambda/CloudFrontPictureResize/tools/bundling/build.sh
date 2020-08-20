#!/usr/bin/env bash

set -e

export HOME=/development
echo "Package Version: ${PACKAGE_VERSION}"

echo "Installing npm dependencies"
npm install

echo "Compiling the code"
npm run compile

echo "Copying compiled assets"
cp dist/* /asset-output
cp package.json package-lock.json /asset-output

echo "Installing prod dependencies"
(
  cd /asset-output || exit
  npm install --only=prod
)

echo "Version File"
echo "${PACKAGE_VERSION}" >/asset-output/VERSION
