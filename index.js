const express = require("express")
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const ffmpeg = require("fluent-ffmpeg") 

const app = express();
const PORT = 3000;


//Configuring multer for disk storage
const storage = multer.diskStorage({
    destination : function(req, file, cb){
        cb(null, "uploads/")
    },
    filename : function(req, file, cb){
        cb(null, file.originalname);
    }
})
const upload = multer({storage : storage})

// Upload API
app.post("/upload", upload.single("video"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }
  
    res.status(200).json({
      message: "Video uploaded successfully",
      filename: req.file.filename,
      size: req.file.size,
    });
  });

//Convert to another format
app.post("/convert", express.json(), (req, res) => {
    const{ filename, format } = req.body;

    if(!filename || !format){
        return res.status(400).json({error : "Missing filename or format"});
    }

    const inputPath = path.join(__dirname, "uploads", filename);
    const nameWithoutExt = path.basename(filename, path.extname(filename));
    const outputFilename = `${nameWithoutExt}.${format}`;
    const outputPath = path.join(__dirname, "converted", outputFilename);

    if(!fs.existsSync(inputPath)){
        return res.status(404).json({error : "File not found"});
    }

    ffmpeg(inputPath).toFormat(format).on("end", () => {
        res.status(200).json({
            message : "Video converted successfully", outputFilename
        })
    }).on("error", (err) => {
        console.log("Conversion error : ", err.message);
        res.status(500).json({error : "Conversion failed"})
    }).save(outputPath);
}); 

//Download API
app.get("/download/:filename", (req, res) => {
    const {filename} = req.params;

    const filePath = path.join(__dirname, "converted", filename);

    if(!fs.existsSync(filePath)){
        return res.status(400).json({error : "File not found"})
    }

    res.download(filePath, filename, (err) => {
        if(err){
            console.error("Download error : ", err.message);
            res.status(500).json({error : "Download failed"});
        }
    });
});

//Get video metadata
app.get("/info/:filename", (req, res) => {
    const { filename } = req. params;

    const inputPath = path.join(__dirname, "uploads", filename);

    if(!fs.existsSync(inputPath)){
        return res.status(404).json({error : "File not found"});
    }

    ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if(err) {
            console.error("Error : ", err.message);
            return res.status(500).json({error : "Failed to fetch metadata"})
        }

        const formatInfo = metadata.format;
        const videoStream = metadata.streams.find(s => s.codec_type = "video");

        res.status(200).json({
            filename,
            duration : formatInfo.duration,
            size : formatInfo.size,
            format : formatInfo.size,
            format : formatInfo.format_name,
            bitrate : formatInfo.bit_rate,
            video : videoStream ? {
                codec : videoStream.codec_name,
                width : videoStream.width,
                height : videoStream.height,
                framerate : eval(videoStream.r_frame_rate)
            } : null
        })
    })
})

//Video trimming
app.post("/trim", express.json(), (req,res) => {
    const {filename, start, duration, format } = req.body;

    if(!filename || start == null || duration == null || !format){
        return res.status(400).json({error : "Missing required fields"}); 
    }

    const inputPath = path.join(__dirname, "uploads", filename);
    const nameWithoutExt = path.basename(filename, path.extname(filename));
    const outputFileName = `${nameWithoutExt}_trimmed.${format}`;
    const outputPath = path.join(__dirname, "converted", outputFileName);

    if(!fs.existsSync(inputPath)){
        return res.status(400).json({error : "Input file not found"});
    }

    ffmpeg(inputPath).setStartTime(start).setDuration(duration)
    .output(outputPath)
    .on("end", () => {
        res.status(200).json({
            message : "Video trimmed succesfully",
            outputFileName,
        });
    })
    .on("error", (err) => {
        console.error("Trimming error : ", err.message);
        res.status(500).json({error : "Video trimming failed"})
    })
    .run();
})


  app.listen(PORT, () => {
    console.log("Port is running");
  })