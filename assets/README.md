# How to Add Photos to the Gallery

You can add photos to your gallery in two simple steps.

## Step 1: Place Your Photos Here

You can name your image files anything you like (e.g., `my-vacation.jpg`, `cityscape.png`, `project-screenshot.gif`).

Place your image files directly inside this `assets` folder.

## Step 2: Update the Gallery Component

For the application to find your new photos, you must add their file paths to the list in the gallery component.

1.  Open the file: `components/GalleryPage.tsx`
2.  Find the `images` array near the top of the file.
3.  Add the path to your new image. The path **must** start with `/assets/`.

### Example

If you added an image named `my-dog.jpg` to this folder, you would add the following line to the `images` array in `components/GalleryPage.tsx`:

```javascript
const images = [
  '/assets/gallery1.jpg',
  '/assets/gallery2.jpg',
  // ... other images ...
  '/assets/my-dog.jpg', // <-- Add your new image path here
];
```

That's it! Your new photo will now appear in the gallery.
