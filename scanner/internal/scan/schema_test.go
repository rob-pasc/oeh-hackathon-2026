package scan

import (
	"bytes"
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// Contract test (ADR-001): the payload the scanner produces validates against the exported
// DeviceScan schema, the same one the server enforces.
func TestOutputMatchesSharedSchema(t *testing.T) {
	schemaPath, err := filepath.Abs(filepath.Join("..", "..", "..", "shared", "schemas", "DeviceScan.schema.json"))
	if err != nil {
		t.Fatal(err)
	}
	c := jsonschema.NewCompiler()
	c.AssertFormat()
	sch, err := c.Compile(schemaPath)
	if err != nil {
		t.Fatalf("compile %s: %v", schemaPath, err)
	}
	fixtures, _ := filepath.Glob(filepath.Join("testdata", "*.raw.json"))
	if len(fixtures) == 0 {
		t.Fatal("no fixtures")
	}
	cases := map[string]Raw{"all sources failed": {}}
	for _, f := range fixtures {
		cases[filepath.Base(f)] = loadRaw(t, filepath.Base(f))
	}
	for name, raw := range cases {
		data, err := json.Marshal(Normalize(raw, testMeta))
		if err != nil {
			t.Fatal(err)
		}
		doc, err := jsonschema.UnmarshalJSON(bytes.NewReader(data))
		if err != nil {
			t.Fatal(err)
		}
		if err := sch.Validate(doc); err != nil {
			t.Errorf("%s does not match the schema: %v\n%s", name, err, data)
		}
	}

	// The check has teeth: an extra identifying field fails validation.
	bad, _ := json.Marshal(map[string]any{"serial_number": "X"})
	merged := append(bytes.TrimSuffix(mustJSON(t, Normalize(Raw{}, testMeta)), []byte("}")), append([]byte(","), bad[1:]...)...)
	doc, err := jsonschema.UnmarshalJSON(bytes.NewReader(merged))
	if err != nil {
		t.Fatal(err)
	}
	if sch.Validate(doc) == nil {
		t.Error("schema accepted a payload with serial_number")
	}
}

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return data
}
