#!/bin/sh
# Builds the macOS scanner as a zipped, ad-hoc signed universal app (feature 007 FR-001, FR-017).
# Runs on macOS only: Gio needs cgo and the macOS SDK. Used by CI and for local builds on a Mac.
#
#   scanner/packaging/macos/build.sh <backend-url> <version> <out-dir>
#
# Writes <out-dir>/leaaf-scanner-macos.zip holding leaaf-scanner.app. The server renames the
# bundle to leaaf-scanner-<session>.app for a session download (see run.SessionFromBundle); the
# signature does not cover the bundle's own name, so that keeps it valid.
set -eu

backend=${1:?backend URL}
version=${2:?version}
out=${3:?output directory}
here=$(cd "$(dirname "$0")" && pwd)
scanner=$(cd "$here/../.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

ldflags="-s -w -X main.backendURL=$backend -X main.version=$version"
for arch in amd64 arm64; do
	(cd "$scanner" && CGO_ENABLED=1 GOOS=darwin GOARCH=$arch MACOSX_DEPLOYMENT_TARGET=12.0 \
		go build -trimpath -ldflags "$ldflags" -o "$work/leaaf-scanner-$arch" ./cmd/leaaf-scanner)
done

app="$work/leaaf-scanner.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
lipo -create -output "$app/Contents/MacOS/leaaf-scanner" "$work/leaaf-scanner-amd64" "$work/leaaf-scanner-arm64"
sed "s/@VERSION@/$version/g" "$here/Info.plist" >"$app/Contents/Info.plist"

# The leaf icon (feature 001 FR-016). The committed PNGs stop at 256 px; sips scales up the larger
# Retina sizes, which is fine for this line drawing.
icons="$scanner/cmd/leaaf-scanner/winres"
set_="$work/leaaf.iconset"
mkdir "$set_"
for s in 16 32 128 256 512; do
	src="$icons/icon-$(( s > 256 ? 256 : s )).png"
	sips -z $s $s "$src" --out "$set_/icon_${s}x${s}.png" >/dev/null
	d=$(( s * 2 ))
	src="$icons/icon-$(( d > 256 ? 256 : d )).png"
	sips -z $d $d "$src" --out "$set_/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$set_" -o "$app/Contents/Resources/leaaf.icns"

# Ad-hoc signature over the whole bundle: Apple Silicon only runs signed code, and a valid
# signature lets macOS offer "Open Anyway" instead of calling the app damaged. Nothing may be
# changed inside the bundle after this.
codesign --force --deep --sign - "$app"
codesign --verify --deep --strict "$app"

mkdir -p "$out"
# Absolute, because ditto below runs inside $work, where a relative path would land in the
# temporary folder that the EXIT trap deletes.
out=$(cd "$out" && pwd)
rm -f "$out/leaaf-scanner-macos.zip"
(cd "$work" && ditto -c -k --keepParent leaaf-scanner.app "$out/leaaf-scanner-macos.zip")
echo "wrote $out/leaaf-scanner-macos.zip"
