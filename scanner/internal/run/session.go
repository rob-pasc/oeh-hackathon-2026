package run

import (
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// SessionMarker precedes the session ID that the server appends to a downloaded scanner
// (shared/src/session.ts, SCANNER_SESSION_MARKER). The "1" versions the trailer format.
const SessionMarker = "LEAAFSCAN1:"

const sessionIDLen = 26

var sessionIDPattern = regexp.MustCompile(`^[0-9A-HJKMNP-TV-Z]{26}$`)

// ReadSessionID reads the trailer at the end of the executable at path. Windows never loads bytes
// after the last PE section, so the server can append them without changing the program. A build
// without the trailer (a dev build or a plain download) yields "".
func ReadSessionID(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	n := int64(len(SessionMarker) + sessionIDLen)
	if _, err := f.Seek(-n, io.SeekEnd); err != nil {
		return "" // shorter than the trailer
	}
	buf := make([]byte, n)
	if _, err := io.ReadFull(f, buf); err != nil {
		return ""
	}
	if string(buf[:len(SessionMarker)]) != SessionMarker {
		return ""
	}
	id := string(buf[len(SessionMarker):])
	if !sessionIDPattern.MatchString(id) {
		return ""
	}
	return id
}

// BundlePrefix starts the name of a macOS app bundle that carries a session:
// "leaaf-scanner-<session>.app" (feature 007 FR-012). A Mac app's signature covers everything
// inside the bundle but not the bundle folder's own name, so the server can put the session there
// without invalidating it. macOS keeps the name when it runs a downloaded app from a randomized
// read-only location (App Translocation).
const BundlePrefix = "leaaf-scanner-"

// SessionFromBundle reads the session ID from the name of the .app bundle that contains the
// executable at path (…/leaaf-scanner-<session>.app/Contents/MacOS/leaaf-scanner). Anything else
// yields "".
func SessionFromBundle(path string) string {
	for dir := filepath.Dir(path); dir != filepath.Dir(dir); dir = filepath.Dir(dir) {
		name := filepath.Base(dir)
		if !strings.HasSuffix(name, ".app") {
			continue
		}
		id := strings.TrimSuffix(strings.TrimPrefix(name, BundlePrefix), ".app")
		if strings.HasPrefix(name, BundlePrefix) && sessionIDPattern.MatchString(id) {
			return id
		}
		return ""
	}
	return ""
}
