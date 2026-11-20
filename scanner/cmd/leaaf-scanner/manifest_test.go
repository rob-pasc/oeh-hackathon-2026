package main

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"
)

// The scanner must ask for administrator rights on start (feature 001 FR-001). The Windows
// build links the committed .syso, so check both the source config and the generated file;
// a stale .syso after editing winres.json shows up here.
func TestManifestRequiresAdministrator(t *testing.T) {
	raw, err := os.ReadFile("winres/winres.json")
	if err != nil {
		t.Fatal(err)
	}
	var cfg struct {
		Manifest map[string]map[string]struct {
			ExecutionLevel string `json:"execution-level"`
		} `json:"RT_MANIFEST"`
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		t.Fatal(err)
	}
	if got := cfg.Manifest["#1"]["0409"].ExecutionLevel; got != "administrator" {
		t.Errorf("winres.json execution-level = %q, want administrator", got)
	}

	syso, err := os.ReadFile("rsrc_windows_amd64.syso")
	if err != nil {
		t.Fatalf("%v (run go generate ./cmd/leaaf-scanner)", err)
	}
	if !bytes.Contains(syso, []byte(`level="requireAdministrator"`)) {
		t.Error(`rsrc_windows_amd64.syso does not request requireAdministrator; rerun go generate ./cmd/leaaf-scanner`)
	}
}

// The exe, title bar, and taskbar use the leaf favicon (feature 001 FR-016). Gio's window
// class loads icon resource 1, so the group must be "#1"; each listed size must exist, and the
// .syso must contain one image per size (go-winres stores them as PNG).
func TestIconResource(t *testing.T) {
	raw, err := os.ReadFile("winres/winres.json")
	if err != nil {
		t.Fatal(err)
	}
	var cfg struct {
		Icons map[string]map[string][]string `json:"RT_GROUP_ICON"`
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		t.Fatal(err)
	}
	files := cfg.Icons["#1"]["0000"]
	if len(files) == 0 {
		t.Fatal(`winres.json has no RT_GROUP_ICON "#1"`)
	}
	for _, f := range files {
		b, err := os.ReadFile("winres/" + f)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.HasPrefix(b, []byte("\x89PNG")) {
			t.Errorf("%s is not a PNG", f)
		}
	}
	syso, err := os.ReadFile("rsrc_windows_amd64.syso")
	if err != nil {
		t.Fatal(err)
	}
	if got := bytes.Count(syso, []byte("\x89PNG")); got != len(files) {
		t.Errorf("rsrc_windows_amd64.syso holds %d icon images, want %d; rerun go generate ./cmd/leaaf-scanner", got, len(files))
	}
}
