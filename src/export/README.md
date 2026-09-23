# src/export

Excel (`excel/`: one builder per sheet plus a style module) and PDF (`pdf/`) writers. Exporters consume engine results and the frozen rates snapshot; they never recompute a valuation formula in TypeScript. Excel formulas are the workbook's own live model and are checked against the engine after LibreOffice recalculation.
