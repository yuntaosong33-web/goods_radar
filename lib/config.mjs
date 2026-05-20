import { existsSync } from 'fs';
import { loadYamlFile } from './yaml-lite.mjs';

export function loadMission() {
  const activePath = 'config/mission.yml';
  const examplePath = 'config/mission.example.yml';
  const path = existsSync(activePath) ? activePath : examplePath;
  const mission = loadYamlFile(path);
  if (!mission) throw new Error('No mission config found. Copy config/mission.example.yml to config/mission.yml.');
  return { mission, path, usingExample: path === examplePath };
}

export function loadSources() {
  const activePath = 'config/sources.yml';
  const examplePath = 'config/sources.example.yml';
  const path = existsSync(activePath) ? activePath : examplePath;
  const sources = loadYamlFile(path);
  return { sources: sources ?? {}, path, usingExample: path === examplePath };
}

export function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}
