export function checkSave(valid: unknown): asserts valid {
if (!valid) throw new Error('Save contains incompatible content')
}
