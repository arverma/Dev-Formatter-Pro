import { diffFormatted } from '../../../features/diff/diffFormatted';

interface DiffMarksController {
  clearDiffMarks: () => void;
  applyDiffMarks: (hunks: ReturnType<typeof diffFormatted>) => void;
}

export function createDiffMarksController(deps: {
  inputEditor: any;
  outputEditor: any;
}): DiffMarksController {
  let diffLineMarks: { editor: any; line: number; cls: string }[] = [];

  function clearDiffMarks() {
    for (const mark of diffLineMarks) {
      mark.editor.removeLineClass(mark.line, 'background', mark.cls);
    }
    diffLineMarks = [];
  }

  function applyDiffMarks(hunks: ReturnType<typeof diffFormatted>) {
    clearDiffMarks();
    let aLine = 0;
    let bLine = 0;
    for (const hunk of hunks) {
      if (hunk.type === 'equal') {
        aLine += hunk.lines.length;
        bLine += hunk.lines.length;
        continue;
      }
      if (hunk.type === 'remove') {
        for (let i = 0; i < hunk.lines.length; i++) {
          const line = aLine + i;
          deps.inputEditor.addLineClass(line, 'background', 'cm-diff-remove');
          diffLineMarks.push({
            editor: deps.inputEditor,
            line,
            cls: 'cm-diff-remove',
          });
        }
        aLine += hunk.lines.length;
        continue;
      }
      for (let i = 0; i < hunk.lines.length; i++) {
        const line = bLine + i;
        deps.outputEditor.addLineClass(line, 'background', 'cm-diff-add');
        diffLineMarks.push({
          editor: deps.outputEditor,
          line,
          cls: 'cm-diff-add',
        });
      }
      bLine += hunk.lines.length;
    }
  }

  return { clearDiffMarks, applyDiffMarks };
}
