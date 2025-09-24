{{ range .Versions }}
<a name="{{ .Tag.Name }}"></a>

## {{ if .Tag.Previous }}[{{ .Tag.Name }}]{{ else }}{{ .Tag.Name }}{{ end }} - {{ datetime "02.01.2006" .Tag.Date }}

{{ range .CommitGroups -}}

### {{ .Title }}

{{ range .Commits -}}

- {{ if .Scope }}**{{ .Scope }}:** {{ end }}{{ .Subject }}

{{ end }}

{{ end -}}

{{- if .NoteGroups -}}
{{ range .NoteGroups -}}

### {{ .Title }}

{{ range .Notes }}
{{ .Body }}
{{ end }}

{{ end -}}
{{ end -}}

{{ end -}}

{{- if .Versions }}
[Unreleased]: {{ .Info.RepositoryURL }}/compare/{{ $latest := index .Versions 0 }}{{ $latest.Tag.Name }}...HEAD
{{ range .Versions -}}
{{ if .Tag.Previous -}}
[{{ .Tag.Name }}]: {{ $.Info.RepositoryURL }}/compare/{{ .Tag.Previous.Name }}...{{ .Tag.Name }}
{{ end -}}
{{ end -}}
{{ end -}}
