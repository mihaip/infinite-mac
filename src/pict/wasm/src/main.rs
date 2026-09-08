fn main() {}

// The JS bridge owns every allocation and frees it with its original length.
#[no_mangle]
pub extern "C" fn pict_allocate(len: usize) -> *mut u8 {
    Box::into_raw(vec![0u8; len].into_boxed_slice()) as *mut u8
}

#[no_mangle]
pub unsafe extern "C" fn pict_free(ptr: *mut u8, len: usize) {
    drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
}

// Result: RGBA pointer, byte length, width, height. Return nonzero on failure.
#[no_mangle]
pub unsafe extern "C" fn pict_decode(data: *const u8, len: usize, out: *mut usize) -> i32 {
    if len > 4 * 1024 * 1024 { return 1; }
    match oxideav_pict::parse_pict(std::slice::from_raw_parts(data, len)) {
        Ok(image) => {
            // The standalone decoder cannot render compressed QuickTime data.
            // Avoid presenting its blank/partial canvas as a complete preview.
            if !image.quicktime.is_empty() { return 2; }
            if image.data.len() > 16 * 1024 * 1024 { return 3; }
            let pixels = image.data.into_boxed_slice();
            *out = pixels.as_ptr() as usize;
            *out.add(1) = pixels.len();
            *out.add(2) = image.width as usize;
            *out.add(3) = image.height as usize;
            std::mem::forget(pixels);
            0
        }
        Err(_) => 1,
    }
}
