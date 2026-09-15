use stuffit::{SitArchive, SitEntry};
use wasm_bindgen::prelude::*;

const MAX_ENTRY_SIZE: usize = 128 * 1024 * 1024;

#[wasm_bindgen]
pub struct StuffItArchive {
    archive: SitArchive,
}

#[wasm_bindgen]
impl StuffItArchive {
    #[wasm_bindgen(constructor)]
    pub fn new(data: &[u8]) -> Result<StuffItArchive, JsError> {
        let archive = SitArchive::parse(data)
            .map_err(|_| JsError::new("This is not a supported StuffIt archive."))?;
        Ok(StuffItArchive { archive })
    }

    #[wasm_bindgen(getter, js_name = entryCount)]
    pub fn entry_count(&self) -> usize {
        self.archive.entries.len()
    }

    #[wasm_bindgen(js_name = entryName)]
    pub fn entry_name(&self, index: usize) -> Result<String, JsError> {
        Ok(self.entry(index)?.name.clone())
    }

    #[wasm_bindgen(js_name = entryIsDirectory)]
    pub fn entry_is_directory(&self, index: usize) -> Result<bool, JsError> {
        Ok(self.entry(index)?.is_folder)
    }

    #[wasm_bindgen(js_name = entryContents)]
    pub fn entry_contents(&self, index: usize) -> Result<Box<[u8]>, JsError> {
        let entry = self.entry(index)?;
        if entry.is_folder {
            return Err(invalid_entry());
        }
        if u64::from(entry.data_ulen) + u64::from(entry.rsrc_ulen) > MAX_ENTRY_SIZE as u64 {
            return Err(entry_too_large());
        }

        let (data, resource) = entry
            .decompressed_forks()
            .map_err(|_| JsError::new("This StuffIt entry could not be decompressed."))?;
        if data.len().saturating_add(resource.len()) > MAX_ENTRY_SIZE {
            return Err(entry_too_large());
        }
        Ok(data.into_boxed_slice())
    }
}

impl StuffItArchive {
    fn entry(&self, index: usize) -> Result<&SitEntry, JsError> {
        self.archive.entries.get(index).ok_or_else(invalid_entry)
    }
}

fn invalid_entry() -> JsError {
    JsError::new("The StuffIt archive contains an invalid entry.")
}

fn entry_too_large() -> JsError {
    JsError::new("StuffIt entries larger than 128 MB are not supported.")
}
