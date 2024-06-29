import React, { useState } from "react";
import axios from "axios";
import { Buffer } from "buffer";
import "./App.css";

const App = () => {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);

  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const uploadChunk = async (uploadId, partNumber, chunk) => {
    const base64Chunk = chunk.toString("base64");
    const response = await axios.post("http://localhost:5000/upload/part", {
      uploadId,
      partNumber,
      name: file.name,
      chunk: base64Chunk,
    });
    return response.data.ETag;
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    try {
      const startResponse = await axios.post(
        "http://localhost:5000/upload/start",
        {
          name: file.name,
          type: file.type,
        }
      );

      const { uploadId } = startResponse.data;
      const fileSize = file.size;
      let partNumber = 1;
      const parts = [];
      setUploadProgress(10);
      for (let start = 0; start < fileSize; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE, fileSize);
        const chunk = file.slice(start, end);

        const reader = new FileReader();
        reader.readAsArrayBuffer(chunk);
        reader.onload = async () => {
          const arrayBuffer = reader.result;
          const buffer = Buffer.from(arrayBuffer);
          const ETag = await uploadChunk(uploadId, partNumber, buffer);
          parts.push({ ETag, PartNumber: partNumber });
          partNumber++;
          setUploadProgress(Math.round((end / fileSize) * 100));
          if (end >= fileSize) {
            const completeResponse = await axios.post(
              "http://localhost:5000/upload/complete",
              {
                uploadId,
                name: file.name,
                parts,
                title,
                description,
              }
            );
            setUploadedFile(completeResponse.data);
            setUploadProgress(100);
          }
        };
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  return (
    <div className="App">
      <form onSubmit={handleUpload}>
        <input
          type="file"
          accept="video/*,audio/*"
          onChange={handleFileChange}
        />
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit">Upload</button>
      </form>
      {uploadProgress > 0 && (
        <progress value={uploadProgress} max="100">
          {uploadProgress}%
        </progress>
      )}
      {uploadedFile && (
        <div>
          <strong>{uploadedFile.title}</strong>
          <p>{uploadedFile.description}</p>
          <p>
            <a
              href={uploadedFile.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {uploadedFile.name}
            </a>
          </p>
        </div>
      )}
    </div>
  );
};

export default App;
