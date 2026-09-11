' 双击即启动,无黑窗
CreateObject("WScript.Shell").CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolder(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run """build\bin\PersonalTerminal.exe""", 0, False
