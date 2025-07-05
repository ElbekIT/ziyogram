import { db, storage } from "./firebase-config.js"
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js"

class ZiyoGram {
  constructor() {
    this.currentUser = null
    this.currentChat = null
    this.users = new Map()
    this.chats = new Map()
    this.init()
  }

  init() {
    this.loadUserFromStorage()
    this.setupEventListeners()
    this.showAppropriateScreen()
  }

  loadUserFromStorage() {
    const userData = localStorage.getItem("ziyogram_user")
    if (userData) {
      this.currentUser = JSON.parse(userData)
    }
  }

  saveUserToStorage() {
    localStorage.setItem("ziyogram_user", JSON.stringify(this.currentUser))
  }

  showAppropriateScreen() {
    if (this.currentUser) {
      this.showMainScreen()
    } else {
      this.showPhoneScreen()
    }
  }

  showPhoneScreen() {
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"))
    document.getElementById("phone-screen").classList.add("active")
  }

  showProfileScreen() {
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"))
    document.getElementById("profile-screen").classList.add("active")
  }

  showMainScreen() {
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"))
    document.getElementById("main-screen").classList.add("active")

    if (this.currentUser) {
      this.updateSidebarUserInfo()
      this.loadUsers()
      this.loadChats()
    }
  }

  setupEventListeners() {
    // Phone registration
    document.getElementById("next-btn").addEventListener("click", () => {
      this.handlePhoneSubmit()
    })

    // Profile setup
    document.getElementById("profile-image").addEventListener("change", (e) => {
      this.handleImageUpload(e)
    })

    document.querySelector(".profile-image-container").addEventListener("click", () => {
      document.getElementById("profile-image").click()
    })

    document.getElementById("start-messaging-btn").addEventListener("click", () => {
      this.handleProfileSubmit()
    })

    // Main screen
    document.getElementById("menu-btn").addEventListener("click", () => {
      this.toggleSidebar()
    })

    document.getElementById("sidebar-close").addEventListener("click", () => {
      this.closeSidebar()
    })

    // Message sending
    document.getElementById("send-btn").addEventListener("click", () => {
      this.sendMessage()
    })

    document.getElementById("message-input").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage()
      }
    })

    // Search functionality
    document.getElementById("search-input").addEventListener("input", (e) => {
      this.searchUsers(e.target.value)
    })

    // Night mode toggle
    document.getElementById("night-mode-toggle").addEventListener("change", (e) => {
      this.toggleNightMode(e.target.checked)
    })
  }

  async handlePhoneSubmit() {
    const countryCode = document.getElementById("country-code").value
    const phoneNumber = document.getElementById("phone-number").value.trim()

    if (!phoneNumber) {
      alert("Please enter your phone number")
      return
    }

    const fullPhoneNumber = countryCode + phoneNumber

    // Check if user already exists
    const userQuery = query(collection(db, "users"), where("phone", "==", fullPhoneNumber))
    const userSnapshot = await getDocs(userQuery)

    if (!userSnapshot.empty) {
      // User exists, log them in
      const userData = userSnapshot.docs[0].data()
      this.currentUser = {
        id: userSnapshot.docs[0].id,
        ...userData,
      }
      this.saveUserToStorage()
      this.showMainScreen()
    } else {
      // New user, go to profile setup
      this.tempPhone = fullPhoneNumber
      this.showProfileScreen()
    }
  }

  handleImageUpload(event) {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const preview = document.getElementById("profile-preview")
        const placeholder = document.getElementById("upload-placeholder")

        preview.src = e.target.result
        preview.style.display = "block"
        placeholder.style.display = "none"
      }
      reader.readAsDataURL(file)
    }
  }

  async handleProfileSubmit() {
    const firstName = document.getElementById("first-name").value.trim()
    const lastName = document.getElementById("last-name").value.trim()
    const imageFile = document.getElementById("profile-image").files[0]

    if (!firstName) {
      alert("Please enter your first name")
      return
    }

    let profileImageUrl = ""

    // Upload profile image if provided
    if (imageFile) {
      try {
        const imageRef = ref(storage, `profile-images/${Date.now()}_${imageFile.name}`)
        const snapshot = await uploadBytes(imageRef, imageFile)
        profileImageUrl = await getDownloadURL(snapshot.ref)
      } catch (error) {
        console.error("Error uploading image:", error)
      }
    }

    // Create user document
    const userData = {
      phone: this.tempPhone,
      firstName: firstName,
      lastName: lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      profileImage: profileImageUrl,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      isOnline: true,
    }

    try {
      const docRef = await addDoc(collection(db, "users"), userData)
      this.currentUser = {
        id: docRef.id,
        ...userData,
      }
      this.saveUserToStorage()
      this.showMainScreen()
    } catch (error) {
      console.error("Error creating user:", error)
      alert("Error creating account. Please try again.")
    }
  }

  updateSidebarUserInfo() {
    if (this.currentUser) {
      const avatar = document.getElementById("sidebar-avatar")
      const name = document.getElementById("sidebar-name")

      if (this.currentUser.profileImage) {
        avatar.src = this.currentUser.profileImage
      } else {
        avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser.fullName)}&background=0088cc&color=fff`
      }

      name.textContent = this.currentUser.fullName
    }
  }

  async loadUsers() {
    const usersQuery = query(collection(db, "users"))
    onSnapshot(usersQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const userData = { id: change.doc.id, ...change.doc.data() }
          this.users.set(change.doc.id, userData)

          // Don't show current user in chat list
          if (userData.id !== this.currentUser.id) {
            this.addUserToChatList(userData)
          }
        }
      })
    })
  }

  addUserToChatList(user) {
    const chatList = document.getElementById("chat-list")
    let chatItem = document.querySelector(`[data-user-id="${user.id}"]`)

    if (!chatItem) {
      chatItem = document.createElement("div")
      chatItem.className = "chat-item"
      chatItem.setAttribute("data-user-id", user.id)
      chatList.appendChild(chatItem)

      chatItem.addEventListener("click", () => {
        this.openChat(user)
      })
    }

    const avatarUrl =
      user.profileImage ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=0088cc&color=fff`

    chatItem.innerHTML = `
            <div class="chat-item-avatar">
                <img src="${avatarUrl}" alt="${user.fullName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
            </div>
            <div class="chat-item-content">
                <div class="chat-item-header">
                    <div class="chat-item-name">${user.fullName}</div>
                    <div class="chat-item-time">online</div>
                </div>
                <div class="chat-item-message">Click to start chatting</div>
            </div>
        `
  }

  openChat(user) {
    this.currentChat = user

    // Update active chat UI
    document.querySelectorAll(".chat-item").forEach((item) => item.classList.remove("active"))
    document.querySelector(`[data-user-id="${user.id}"]`).classList.add("active")

    // Show chat area
    document.querySelector(".empty-chat").style.display = "none"
    document.getElementById("active-chat").style.display = "flex"

    // Update chat header
    const chatAvatar = document.getElementById("chat-avatar")
    const chatName = document.getElementById("chat-name")

    const avatarUrl =
      user.profileImage ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=0088cc&color=fff`

    chatAvatar.src = avatarUrl
    chatName.textContent = user.fullName

    // Load messages
    this.loadMessages(user.id)

    // On mobile, show chat area
    if (window.innerWidth <= 768) {
      document.querySelector(".chat-area").classList.add("mobile-active")
    }
  }

  async loadMessages(userId) {
    const messagesContainer = document.getElementById("messages-container")
    messagesContainer.innerHTML = ""

    // Create chat ID (consistent ordering)
    const chatId = [this.currentUser.id, userId].sort().join("_")

    const messagesQuery = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"))

    onSnapshot(messagesQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const messageData = change.doc.data()
          this.addMessageToUI(messageData)
        }
      })

      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight
    })
  }

  addMessageToUI(messageData) {
    const messagesContainer = document.getElementById("messages-container")
    const messageDiv = document.createElement("div")

    const isOwn = messageData.senderId === this.currentUser.id
    messageDiv.className = `message ${isOwn ? "sent" : "received"}`

    const timestamp = messageData.timestamp
      ? new Date(messageData.timestamp.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    messageDiv.innerHTML = `
            <div class="message-content">${messageData.text}</div>
            <div class="message-time">${timestamp}</div>
        `

    messagesContainer.appendChild(messageDiv)
  }

  async sendMessage() {
    const messageInput = document.getElementById("message-input")
    const messageText = messageInput.value.trim()

    if (!messageText || !this.currentChat) return

    const chatId = [this.currentUser.id, this.currentChat.id].sort().join("_")

    const messageData = {
      text: messageText,
      senderId: this.currentUser.id,
      senderName: this.currentUser.fullName,
      receiverId: this.currentChat.id,
      timestamp: serverTimestamp(),
      chatId: chatId,
    }

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), messageData)
      messageInput.value = ""
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  loadChats() {
    // This would load existing chats/conversations
    // For now, we're showing all users as potential chats
  }

  searchUsers(searchTerm) {
    const chatItems = document.querySelectorAll(".chat-item")
    chatItems.forEach((item) => {
      const name = item.querySelector(".chat-item-name").textContent.toLowerCase()
      if (name.includes(searchTerm.toLowerCase())) {
        item.style.display = "flex"
      } else {
        item.style.display = "none"
      }
    })
  }

  toggleSidebar() {
    const sidebar = document.getElementById("sidebar")
    sidebar.classList.toggle("open")
  }

  closeSidebar() {
    const sidebar = document.getElementById("sidebar")
    sidebar.classList.remove("open")
  }

  toggleNightMode(enabled) {
    // Night mode is already the default theme
    // This could be extended to implement a light theme
    console.log("Night mode:", enabled)
  }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ZiyoGram()
})
