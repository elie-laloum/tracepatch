// Deterministic demo adapter, not an LLM or a general-purpose repair system.
let text = '';
for await (const chunk of process.stdin) text += chunk;
const request = JSON.parse(text);
const file = request.files.find((f) => f.path === 'src/total.js');
if (!file) throw new Error('This fixture only supports the bundled cart example');
console.log(
  JSON.stringify({
    summary: 'Multiply unit price by quantity.',
    edits: [
      {
        path: file.path,
        content: file.content.replace('return price;', 'return price * quantity;'),
      },
    ],
  }),
);
