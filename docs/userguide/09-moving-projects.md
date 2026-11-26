# Moving projects between devices

[User guide](README.md) › Moving projects between devices

Projects are saved on the device you made them on. To back them up, share
them, or carry on working on another device, use **project files** or the
**cloud**.

## Project files (`.c64pad`)

A `.c64pad` file holds a whole project: every sprite set, charset and map,
the project's details and its palette. It doesn't include tracing images,
which stay on the device.

**To export a project**, either:

- on **My Projects**, open the project's **⋮** menu and choose **Export**, or
- on the **Project Worksheet**, tap **Transfer → Export**.

In a browser the file downloads; on Android you choose where to save it.

**To import a project**, tap **Transfer → Import** on My Projects and pick
the file. The project opens straight away. If this device already has that
project, the import never overwrites it: it comes in as a separate project
called "… (imported)".

To bring just _some_ of another project's sprite sets, charsets or screens
into the one you're working on, use
[Transfer → From project](02-projects.md#from-another-project) instead.

## The cloud

The cloud keeps projects in your own online storage, so each of your devices
can open them without passing files around. Choose one of:

- **Google Drive**: projects go in a folder in your Drive, as `.c64pad`
  files. C64-Pad can only see the files it made there.
- **Dropbox**: projects go in C64-Pad's own folder in your Dropbox, under
  _Apps_. C64-Pad can't see anything else in your Dropbox.
- **DigitalOcean Space**: for people who run their own storage. You enter
  the Space's region, name, a folder and an access key, which are kept only
  on this device. Setting up a Space is covered in [Cloud](../cloud.md).

Some builds of C64-Pad don't have Google Drive or Dropbox set up; the
settings say so if that's the case.

### Setting it up

1. On **My Projects**, tap **Transfer → Cloud**, then **Settings**.
2. Choose where to keep projects and sign in (or enter the Space's details).
3. Tap **Use Google Drive**, **Use Dropbox** or **Save and use this Space**.

Do the same on each device, with the same account. **Sign out**, **Switch
account** and **Forget on this device** are in the same place.

### Nothing syncs by itself

C64-Pad never uploads or downloads in the background. You decide when:

- **Save to cloud** (a project's **⋮** menu on My Projects) uploads this
  device's copy.
- **Transfer → Cloud** lists the projects in the cloud. **Open** opens one
  that's on this device too; **Download** brings one this device doesn't
  have yet.
- **Update from cloud** (on a project's ⋮ menu) appears when the cloud copy
  is newer.
- **Discard changes…** (on a project's ⋮ menu) replaces this device's copy
  with the cloud copy, throwing away changes made here since.

The cloud list also has **Refresh**, and a delete button for removing a
project from the cloud. Deleting from the cloud keeps the copies on your
devices.

### Sync status

Once the cloud is set up, each project card on My Projects says how it
compares with the cloud:

| Status                   | Meaning                                                         |
| ------------------------ | --------------------------------------------------------------- |
| **Up to date**           | This device and the cloud have the same copy.                   |
| **Newer on this device** | You've changed it here since it was saved to the cloud.         |
| **Newer in the cloud**   | Another device has saved a newer copy.                          |
| **Changed on both**      | It's been changed here _and_ elsewhere since they were in step. |
| **Not in the cloud**     | It's only on this device.                                       |

### When both sides have changed

Each device remembers the version it last saved or opened, so it can tell
which side changed. If saving or opening would throw away changes the other
side has, C64-Pad asks first:

- **Saving**: _Replace the cloud copy?_ **Replace cloud copy** overwrites it
  with this device's copy.
- **Opening**: _Replace this device's copy?_ **Replace** takes the cloud
  copy; **Keep both** keeps this device's copy and adds the cloud copy as a
  separate project called "… (cloud)".

If you're not sure, choose **Keep both**: you can compare the two and copy
across what you need with
[Transfer → From project](02-projects.md#from-another-project).

---

Previous: [Run and export](08-run-and-export.md) · Next:
[C64 graphics basics](10-c64-graphics-basics.md)
