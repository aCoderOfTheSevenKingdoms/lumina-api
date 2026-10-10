import mongoose, { Mongoose, Query } from "mongoose";

const sourceSchema = new mongoose.Schema({
  title: {type: String, default: ""},
  url: {type: String, default: ""},
  favicon: {type: String, default: null},
  score: {type: Number, default: null},
  publishedDate: {type: String, default: null}
}, {_id: false});

const timelineEntrySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["thinking", "search", "sources", "writing"],
    required: true
  },
  query: {type: String, default: null},
  sources: {type: [sourceSchema], default: undefined},
  at: {type: Date, default: Date.now()} 
}, {_id: false});

const messageMetadataSchema = new mongoose.Schema({
  timeline: {type: [timelineEntrySchema], default: []},
  sources: {type: [sourceSchema], default: []},
  durationMs: {type: Number, default: null}
}, {_id: false});

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "ai"],
      required: true,
    },
    metadata: {
      type: messageMetadataSchema,
      default: undefined
    }
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
