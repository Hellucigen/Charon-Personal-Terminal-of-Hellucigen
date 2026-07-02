package core

type PluginManifest struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Version     string   `json:"version"`
	Author      string   `json:"author"`
	Description string   `json:"description"`
	Kind        string   `json:"kind"`
	Entry       string   `json:"entry"`
	Permissions []string `json:"permissions"`
	Icon        string   `json:"icon"`
	HostMin     string   `json:"host_min"`
}