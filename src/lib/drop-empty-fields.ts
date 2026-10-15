/**
 * For a GET form's `onformdata`: fires as the form is turned into a URL and
 * leaves out empty fields, which would otherwise show up as `title=&genre=`.
 */
export function dropEmptyFields(event: FormDataEvent) {
  for (const [name, value] of [...event.formData]) {
    if (value === "") event.formData.delete(name);
  }
}
