#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

const CDK_OUT_DIR = './cdk.out';

function findTemplateFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name.startsWith('assembly-')) {
      const templateFiles = fs.readdirSync(fullPath)
        .filter(file => file.endsWith('.template.json'))
        .map(file => path.join(fullPath, file));
      files.push(...templateFiles);
    }
  }
  return files;
}

interface ExportsOutputFnData {
  exportName: string;
  value: any;
}

interface NamedExportData {
  key: string;
  value: any;
}

interface ImportData {
  path: string;
  value: string;
}

interface AnalysisResult {
  exportsOutputFn: Record<string, ExportsOutputFnData>;
  namedExports: Record<string, NamedExportData>;
  imports: ImportData[];
  content: any;
  filePath: string;
}

function analyzeTemplate(filePath: string): AnalysisResult {
  const content: any = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const outputs: Record<string, any> = content.Outputs || {};
  
  const exportsOutputFn: Record<string, ExportsOutputFnData> = {};
  const namedExports: Record<string, NamedExportData> = {};
  const imports: ImportData[] = [];
  
  // Find all exports
  for (const [key, output] of Object.entries(outputs)) {
    if (key.startsWith('ExportsOutputFn') && output.Export) {
      exportsOutputFn[key] = {
        exportName: output.Export.Name,
        value: output.Value
      };
    } else if (output.Export && !key.startsWith('ExportsOutputFn')) {
      namedExports[output.Export.Name] = {
        key,
        value: output.Value
      };
    }
  }
  
  // Find all imports recursively
  function findImports(obj: any, path: string = ''): void {
    if (typeof obj === 'object' && obj !== null) {
      if (obj['Fn::ImportValue']) {
        const importValue = obj['Fn::ImportValue'];
        if (typeof importValue === 'string' && importValue.includes('ExportsOutputFn')) {
          imports.push({ path, value: importValue });
        }
      }
      
      for (const [key, value] of Object.entries(obj)) {
        findImports(value, path ? `${path}.${key}` : key);
      }
    }
  }
  
  findImports(content);
  
  return { exportsOutputFn, namedExports, imports, content, filePath };
}

function findMatchingNamedExport(exportsOutputFnKey: string, exportsOutputFnValue: any, allNamedExports: Record<string, NamedExportData>): string | null {
  // Try to find a named export with the same value structure
  for (const [exportName, namedExport] of Object.entries(allNamedExports)) {
    if (JSON.stringify(namedExport.value) === JSON.stringify(exportsOutputFnValue)) {
      return exportName;
    }
  }
  return null;
}

function replaceImportsInObject(obj: any, replacements: Record<string, string>): boolean {
  if (typeof obj === 'object' && obj !== null) {
    if (obj['Fn::ImportValue']) {
      const importValue = obj['Fn::ImportValue'];
      if (typeof importValue === 'string' && replacements[importValue]) {
        obj['Fn::ImportValue'] = replacements[importValue];
        return true;
      }
    }
    
    let changed = false;
    for (const value of Object.values(obj)) {
      if (replaceImportsInObject(value, replacements)) {
        changed = true;
      }
    }
    return changed;
  }
  return false;
}

function main(): void {
  if (!fs.existsSync(CDK_OUT_DIR)) {
    console.error(`Error: ${CDK_OUT_DIR} directory does not exist`);
    process.exit(1);
  }
  
  console.log('Analyzing CDK templates...');
  
  const templateFiles: string[] = findTemplateFiles(CDK_OUT_DIR);
  console.log(`Found ${templateFiles.length} template files`);
  
  // Analyze all templates
  const analyses: AnalysisResult[] = templateFiles.map(analyzeTemplate);
  
  // Collect all named exports across all templates
  const allNamedExports: Record<string, NamedExportData> = {};
  for (const analysis of analyses) {
    Object.assign(allNamedExports, analysis.namedExports);
  }
  
  console.log(`\n\tFound ${Object.keys(allNamedExports).length} named exports across all templates`);
  
  // Find ExportsOutputFn exports that have matching named exports
  const replacements: Record<string, string> = {};
  let matchCount: number = 0;
  
  for (const analysis of analyses) {
    for (const [exportsKey, exportsData] of Object.entries(analysis.exportsOutputFn)) {
      const matchingNamed: string | null = findMatchingNamedExport(exportsKey, exportsData.value, allNamedExports);
      if (matchingNamed) {
        replacements[exportsData.exportName] = matchingNamed;
        matchCount++;
        console.log(`> Match found: ${exportsData.exportName} -> ${matchingNamed}`);
      }
    }
  }
  
  console.log(`\n Found ${matchCount} ExportsOutputFn exports with matching named exports`);
  
  if (matchCount === 0) {
    console.log('No optimizations needed.');
    return;
  }
  
  // Apply replacements
  let totalReplacements: number = 0;
  for (const analysis of analyses) {
    let fileChanged: boolean = false;
    
    for (const importData of analysis.imports) {
      if (replacements[importData.value]) {
        console.log(`> Replacing import in ${path.basename(analysis.filePath)}: ${importData.value} -> ${replacements[importData.value]}`);
        fileChanged = true;
        totalReplacements++;
      }
    }
    
    if (fileChanged) {
      const changed: boolean = replaceImportsInObject(analysis.content, replacements);
      if (changed) {
        fs.writeFileSync(analysis.filePath, JSON.stringify(analysis.content, null, 1));
        console.log(`> Updated ${path.basename(analysis.filePath)}`);
      }
    }
  }
  
  console.log(`\n\tOptimization complete! Made ${totalReplacements} import replacements across ${templateFiles.length} files.`);
}

if (require.main === module) {
  main();
}