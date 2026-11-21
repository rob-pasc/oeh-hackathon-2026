package scan

// Step states reported to a scan session (ScanStepEvent.state in shared/src/session.ts).
const (
	StepRunning = "running"
	StepDone    = "done"
	StepSkipped = "skipped"
)

// StepState says how a reading step ended (feature 001 FR-017): StepDone when at least one of the
// step's readings returned a part, StepSkipped when none did, for example a desktop without a
// battery or a disk query that failed. The web app's laptop view lights the step's zones or
// marks them as not read (feature 006 FR-041). Steps without parts of their own ("started",
// "upload") are always StepDone.
func StepState(step string, raw Raw) string {
	var found bool
	switch step {
	case "cpu_memory":
		found = nonEmpty(raw.Processors) || nonEmpty(raw.Memory) || nonEmpty(raw.Video)
	case "storage":
		found = nonEmpty(raw.Disks)
	case "battery":
		// The same rule as the payload, so the session and the uploaded scan agree.
		present := battery(raw).Present
		found = present != nil && *present
	default:
		found = true
	}
	if found {
		return StepDone
	}
	return StepSkipped
}

func nonEmpty[T any](rows *[]T) bool { return rows != nil && len(*rows) > 0 }
