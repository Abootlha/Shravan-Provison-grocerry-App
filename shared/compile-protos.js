const protobuf = require('protobufjs');
const fs = require('fs');
const path = require('path');

async function compileProtos() {
  const protoDir = path.join(__dirname, 'proto');
  const distDir = path.join(__dirname, 'dist', 'proto');
  
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  console.log('Loading proto files...');
  const root = await protobuf.load(path.join(protoDir, 'auth.proto'), undefined, {
    keepCase: false,
    includeDirs: [protoDir]
  });

  console.log('Generating JavaScript...');
  
  const bundle = {};
  root.resolveAll();
  
  function addToBundle(ns) {
    if (ns instanceof protobuf.Type) {
      bundle[ns.fullName] = ns;
    }
    if (ns instanceof protobuf.Enum) {
      bundle[ns.fullName] = ns;
    }
    const nested = ns.nestedArray;
    if (nested) {
      for (const child of nested) {
        addToBundle(child);
      }
    }
  }
  addToBundle(root);

  const typeDefs = [];
  for (const [fullName, type] of Object.entries(bundle)) {
    if (type instanceof protobuf.Type) {
      typeDefs.push(generateInterface(type));
    } else if (type instanceof protobuf.Enum) {
      typeDefs.push(generateEnum(type));
    }
  }

  const tsContent = typeDefs.join('\n\n');
  fs.writeFileSync(path.join(distDir, 'index.d.ts'), tsContent);
  console.log('Written: dist/proto/index.d.ts');

  const jsonRoot = root.toJSON();
  const jsContent = `const protobuf = require('protobufjs');
const root = protobuf.Root.fromJSON(${JSON.stringify(jsonRoot, null, 2)});
module.exports = root;
module.exports.default = root;
`;
  fs.writeFileSync(path.join(distDir, 'index.js'), jsContent);
  console.log('Written: dist/proto/index.js');

  console.log('Proto files compiled successfully!');
}

function generateInterface(type) {
  const fields = type.fieldsArray.map(f => {
    const typeName = getTypeScriptType(f.type, f.map, f.repeated);
    const optional = f.required ? '' : '?';
    return `  ${f.name}${optional}: ${typeName};`;
  }).join('\n');
  return `export interface ${type.name} {\n${fields}\n}`;
}

function generateEnum(e) {
  const values = Object.entries(e.values).map(([name, id]) => `  ${name} = ${id},`).join('\n');
  return `export enum ${e.name} {\n${values}\n}`;
}

function getTypeScriptType(type, isMap, isRepeated) {
  let baseType;
  const typeMap = {
    'double': 'number',
    'float': 'number',
    'int32': 'number',
    'int64': 'number',
    'uint32': 'number',
    'uint64': 'number',
    'sint32': 'number',
    'sint64': 'number',
    'fixed32': 'number',
    'fixed64': 'number',
    'sfixed32': 'number',
    'sfixed64': 'number',
    'bool': 'boolean',
    'string': 'string',
    'bytes': 'Uint8Array'
  };
  baseType = typeMap[type] || type;
  
  if (isMap) {
    return `Map<${baseType}, ${baseType}>`;
  }
  if (isRepeated) {
    return `${baseType}[]`;
  }
  return baseType;
}

compileProtos().catch(console.error);
