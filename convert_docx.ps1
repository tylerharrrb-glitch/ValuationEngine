$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open("C:\Users\mcdr\Desktop\WOLF_Agent_Prompt.docx")
$doc.SaveAs("C:\Users\mcdr\Desktop\ValuationEngine\ValuationEngine\WOLF_Agent_Prompt.txt", 2)
$doc.Close()
$word.Quit()
