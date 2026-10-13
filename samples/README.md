
# Sample Download Instructions

## VSCO 2 CE (Contrabass) - CC0
git clone --depth 1 --filter=blob:none --sparse https://github.com/sgossner/VSCO-2-CE.git
cd VSCO-2-CE
git sparse-checkout set "Strings/Contrabass"
# Copy needed files to samples/bass/

## Virtuosity Drums - CC0
git clone --depth 1 --filter=blob:none --sparse https://github.com/sfzinstruments/virtuosity_drums.git
cd virtuosity_drums
git sparse-checkout set "Samples"
# Copy needed files to samples/drums/

## Salamander Grand Piano - CC BY 3.0 (attribution required)
git clone --depth 1 --filter=blob:none --sparse https://github.com/sgossner/VCSL.git
cd VCSL
git sparse-checkout set "SalamanderGrandPiano"
# Copy needed files to samples/piano/
# ATTRIBUTION REQUIRED: "Salamander Grand Piano by Alexander Holm, CC BY 3.0"

# After downloading, run: npm run process-samples
