## Modificación de nombres de tools.

Necesitamos reducir drásticamente el consumo de tokens en la aplicación.

Para esto vamos a reducir los simbolos de las llamadas a herramientas.
‰inicio ※ final
Y de las respuestas

inicio de respuesta :Э
fin de respuesta :Ч

Ejemplo:

‰{"id":1,"name":"fs.readFile","args":{"path":"./README.md"}}※

(acá hemos optimizado el uso de los tokens de inicio y final de llamada pero
usamos json y en esta llamada tenemos 25 tokens)

queremos pasar a esto.

‰read("1","./README.md")※

pasamos a 11 tokens.
Hay que repensar como se procesan las llamadas, las respuestas no importan, podemos seguir
usando json, creo que las llamadas pueden procesarse con acorn y no usar schemas zod.

## Renombar tools (desde siempre de la base, no crear alias)

fs.readFile:read,
fs.writeFile:write,
fs.rm:rm,
fs.readdir:ls,
fs.replaceString:replace,
pyright.analyze:analysis,
eslint.lint:eslint,
jsdoc.generate:doc,
child_process.exec:execute,
grep.search:grep,
glob.search:glob,
fs.rename:rename,
fs.copyFile:copy,
json.validate,
config.setNickname: nickname,
memento.push,
chatManager.getTokenCount:token,
git.lsFiles:tree,
git.diff:diff,
git.restore:restore,
fs.concatFile:concat,
json.getStructure,
json.getNode,
json.getArrayInfo,
json.updateNode,
github.listIssues,
github.createIssue,
github.editIssue,
github.closeIssue,
github.postComment,
git.remoteUrl:remote,
git.diffAll,
system.notify:notify,
fountain.insertScene:scene,
jszip.listContents:jszip,
binary.analyze,
duckduckgo.search:search,
elinks.render:url,
vm.runInContext:run,
seeImage:img,
ast.analyze,
perf.metrics,
perf.snapshot,
system.reset:reset,
realAction.
