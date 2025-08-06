# 🔁 CDK Imports Swap

**Optimize AWS CDK CloudFormation templates by replacing redundant `ExportsOutputFn` imports with named exports.**

This utility analyzes your synthesized CDK templates from the `cdk.out` directory, identifies where the same exported values are referenced under both `ExportsOutputFn*` and named exports, and rewrites the templates to use named exports for better readability and consistency.

## ✨ Features

- 🔍 Scans all `*.template.json` files inside `cdk.out/assembly-*`
- 📦 Detects `ExportsOutputFn*` style exports
- 🏷 Identifies equivalent named exports across templates
- 🔁 Replaces `Fn::ImportValue` references using `ExportsOutputFn*` with named alternatives
- 🧼 Cleans up cross-stack references and improves maintainability

## 📦 Installation & Usage

### Prerequisites

- Node.js (v14+ recommended)
- TypeScript
- CDK project with `cdk.out` folder (run `cdk synth` first)

### Run the Script

```bash
npx cdk-imports-swap.ts
```

You may also add this as an npm/yarn script inside your project for convenience.

## 📁 Example

**Before optimization:**
```json
"Fn::ImportValue": "ExportsOutputFn12345"
```

**After optimization:**
```json
"Fn::ImportValue": "SharedVpcId"
```

## 🛠 How It Works

1. Loads all templates from `cdk.out/assembly-*/*.template.json`
2. Identifies Outputs with Export keys, separating `ExportsOutputFn*` from named exports
3. Compares values of both export types
4. Finds and replaces matching imports using a named export instead of `ExportsOutputFn`
5. Saves modified template files in place

## 🔒 Safety

- Only modifies files inside the `cdk.out` directory
- Uses deep value comparison to ensure safe replacements
- Outputs logs for every match and modification

## 🧪 Development

To run locally:

```bash
git clone https://github.com/your-org/cdk-imports-swap.git
cd cdk-imports-swap
npm install
npx ts-node src/cdk-imports-swap.ts
```

## 📄 License

MIT © Iurii Favi

## 🤝 Contributing

Pull requests and suggestions are welcome! Please open an issue first to discuss what you would like to change.