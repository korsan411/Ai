#!/bin/bash
# Download latest stable build of Three.js and OpenCV.js into this folder.
# Usage: cd libs && ./download_libs.sh
set -e
echo "Downloading three.min.js (from jsDelivr)..."
curl -L -o three.min.js https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.min.js
echo "Downloading opencv.js (from docs.opencv.org master)..."
curl -L -o opencv.js https://docs.opencv.org/master/opencv.js
echo "Done. Please place these files in the 'libs/' folder if curl is not available."
