package com.hayesmaker64.c64pad;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

/**
 * "Save as": Android's own file picker (Storage Access Framework) to choose a
 * folder and name, then the bytes are written there. The share sheet has no
 * "save to device" target on many tablets, so this is how files reach
 * Downloads, Documents, Drive and so on.
 */
@CapacitorPlugin(name = "SaveAs")
public class SaveAsPlugin extends Plugin {

    /** save({ filename, data: base64 }) -> { saved: boolean, uri?: string } */
    @PluginMethod
    public void save(PluginCall call) {
        String filename = call.getString("filename");
        String data = call.getString("data");
        if (filename == null || data == null) {
            call.reject("filename and data are required");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        // octet-stream keeps the name as given: with a real MIME type some
        // providers append its extension ("project.c64pad.json").
        intent.setType("application/octet-stream");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "onPicked");
    }

    @ActivityCallback
    private void onPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() != null ? result.getData().getData() : null;
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            JSObject ret = new JSObject();
            ret.put("saved", false);
            call.resolve(ret);
            return;
        }
        String data = call.getString("data");
        new Thread(() -> {
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                // "wt": truncate, in case an existing file was picked.
                try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (out == null) throw new java.io.IOException("Could not open " + uri);
                    out.write(bytes);
                }
                JSObject ret = new JSObject();
                ret.put("saved", true);
                ret.put("uri", uri.toString());
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Could not save the file: " + e.getMessage(), e);
            }
        }).start();
    }
}
