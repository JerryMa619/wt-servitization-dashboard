import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Parser, Store } from 'n3';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('public/ontology/sdt_tbox.ttl', root), 'utf8');
const shapes = readFileSync(new URL('public/ontology/sdt_shacl_shapes.ttl', root), 'utf8');
const graph = new Store(new Parser().parse(source));
const shapeGraph = new Store(new Parser().parse(shapes));
const ns = {
  sdt: 'http://purl.org/sdt/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  bfo: 'http://purl.obolibrary.org/obo/',
  iof: 'https://spec.industrialontologies.org/ontology/core/Core/',
  sosa: 'http://www.w3.org/ns/sosa/',
  prov: 'http://www.w3.org/ns/prov#',
  xsd: 'http://www.w3.org/2001/XMLSchema#'
};
const compact = (uri) => {
  for (const [prefix, iri] of Object.entries(ns)) {
    if (uri.startsWith(iri)) return `${prefix}:${uri.slice(iri.length)}`;
  }
  return uri;
};
const values = (subject, predicate) => graph.getObjects(subject, predicate, null);
const text = (subject, predicate) => values(subject, predicate)[0]?.value ?? '';
const terms = (type) => graph.getSubjects(ns.rdf + 'type', ns.owl + type, null)
  .filter((term) => term.termType === 'NamedNode' && term.value.startsWith(ns.sdt))
  .sort((a, b) => a.value.localeCompare(b.value));
const definition = (term) => ({
  id: compact(term.value),
  uri: term.value,
  label: text(term, ns.rdfs + 'label'),
  description: text(term, ns.rdfs + 'comment')
});
const classes = terms('Class').map((term) => ({
  ...definition(term),
  parents: values(term, ns.rdfs + 'subClassOf')
    .filter((parent) => parent.termType === 'NamedNode').map((parent) => compact(parent.value)).sort()
}));
const properties = ['ObjectProperty', 'DatatypeProperty'].flatMap((type) => terms(type).map((term) => ({
  ...definition(term),
  kind: type === 'ObjectProperty' ? 'object' : 'data',
  domain: values(term, ns.rdfs + 'domain').map((value) => compact(value.value)).sort(),
  range: values(term, ns.rdfs + 'range').map((value) => compact(value.value)).sort()
})));
const result = {
  source: 'Chapter 4 / sdt_tbox.ttl',
  version: text(ns.sdt, ns.owl + 'versionInfo'),
  sha256: createHash('sha256').update(source).digest('hex'),
  license: 'CC BY 4.0',
  counts: {
    classes: classes.length,
    objectProperties: properties.filter((property) => property.kind === 'object').length,
    dataProperties: properties.filter((property) => property.kind === 'data').length,
    shapes: shapeGraph.countQuads(null, ns.rdf + 'type', 'http://www.w3.org/ns/shacl#NodeShape', null)
  },
  classes,
  properties
};
const output = JSON.stringify(result, null, 2) + '\n';
const target = new URL('src/data/ontologySchema.json', root);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Ontology schema is stale. Run npm run sync:ontology.');
} else {
  writeFileSync(target, output);
}
console.log(`${process.argv.includes('--check') ? 'Verified' : 'Exported'} ${classes.length} classes, ${properties.length} properties: ${fileURLToPath(target)}`);
