import * as assert from 'node:assert';
import * as vscode from 'vscode';

suite('Extension Security Inspector integration', () => {
  test('activates and registers commands', async () => {
    const extension = vscode.extensions.getExtension(
      'bannysukumar2255.extension-security-inspector',
    );
    assert.ok(extension, 'extension should be present');
    await extension.activate();
    assert.ok(extension.isActive);

    const commands = await vscode.commands.getCommands(true);
    for (const command of [
      'extensionSecurityInspector.auditAll',
      'extensionSecurityInspector.auditSelected',
      'extensionSecurityInspector.exportReport',
      'extensionSecurityInspector.refresh',
      'extensionSecurityInspector.openSettings',
    ]) {
      assert.ok(commands.includes(command), `${command} should be registered`);
    }
  });

  test('exposes the Security Inspector tree view contribution', async () => {
    const extension = vscode.extensions.getExtension(
      'bannysukumar2255.extension-security-inspector',
    );
    assert.ok(extension);
    const views = extension.packageJSON?.contributes?.views?.extensionSecurityInspector as
      Array<{ id: string }> | undefined;
    assert.ok(views?.some((view) => view.id === 'extensionSecurityInspector.mainView'));
  });

  test('run audit command completes without throwing', async () => {
    const extension = vscode.extensions.getExtension(
      'bannysukumar2255.extension-security-inspector',
    );
    assert.ok(extension);
    await extension.activate();
    await vscode.commands.executeCommand('extensionSecurityInspector.auditAll');
  });
});
