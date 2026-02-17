package com.david.amunga.pesamirror

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.RecyclerView
import androidx.viewpager2.widget.ViewPager2
import com.google.android.material.button.MaterialButton

/**
 * Launch activity: shows onboarding on first run, then starts MainActivity.
 */
class LaunchActivity : AppCompatActivity() {

    private lateinit var pager: ViewPager2
    private lateinit var nextButton: MaterialButton
    private lateinit var skipButton: MaterialButton
    private lateinit var dotsContainer: ViewGroup

    private val pages = listOf(
        Page(R.string.onboarding_page1_title, R.string.onboarding_page1_desc),
        Page(R.string.onboarding_page2_title, R.string.onboarding_page2_desc),
        Page(R.string.onboarding_page3_title, R.string.onboarding_page3_desc),
        Page(R.string.onboarding_page4_title, R.string.onboarding_page4_desc),
        Page(R.string.onboarding_page5_title, R.string.onboarding_page5_desc),
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (isOnboardingDone()) {
            startMainAndFinish()
            return
        }
        setContentView(R.layout.activity_launch)
        pager = findViewById(R.id.onboardingPager)
        nextButton = findViewById(R.id.onboardingNext)
        skipButton = findViewById(R.id.onboardingSkip)
        dotsContainer = findViewById(R.id.onboardingDots) as ViewGroup

        pager.adapter = OnboardingAdapter(pages)
        setupDots()
        pager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                updateButtonAndDots(position)
            }
        })

        nextButton.setOnClickListener {
            if (pager.currentItem == pages.size - 1) {
                finishOnboarding()
            } else {
                pager.setCurrentItem(pager.currentItem + 1, true)
            }
        }
        skipButton.setOnClickListener { finishOnboarding() }
        updateButtonAndDots(0)
    }

    private fun setupDots() {
        for (i in pages.indices) {
            val dot = layoutInflater.inflate(
                android.R.layout.simple_list_item_1,
                dotsContainer,
                false
            ) as TextView
            dot.text = "•"
            dot.textSize = 24f
            dot.setOnClickListener { pager.setCurrentItem(i, true) }
            dotsContainer.addView(dot)
        }
    }

    private fun updateButtonAndDots(position: Int) {
        nextButton.text =
            if (position == pages.size - 1) getString(R.string.onboarding_get_started) else getString(
                R.string.onboarding_next
            )
        for (i in 0 until dotsContainer.childCount) {
            val dot = dotsContainer.getChildAt(i) as? TextView ?: continue
            dot.alpha = if (i == position) 1f else 0.4f
        }
    }

    private fun isOnboardingDone(): Boolean =
        SecurePrefs.get(this).getBoolean(KEY_ONBOARDING_DONE, false)

    private fun finishOnboarding() {
        SecurePrefs.get(this).edit().putBoolean(KEY_ONBOARDING_DONE, true).apply()
        startMainAndFinish()
    }

    private fun startMainAndFinish() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }

    private data class Page(val titleRes: Int, val descRes: Int)

    private class OnboardingAdapter(private val pages: List<Page>) :
        RecyclerView.Adapter<OnboardingAdapter.Holder>() {
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
            val v = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_onboarding_page, parent, false)
            return Holder(v)
        }

        override fun onBindViewHolder(holder: Holder, position: Int) {
            val page = pages[position]
            holder.title.setText(page.titleRes)
            holder.desc.setText(page.descRes)
        }

        override fun getItemCount(): Int = pages.size

        class Holder(itemView: View) : RecyclerView.ViewHolder(itemView) {
            val title: TextView = itemView.findViewById(R.id.onboardingTitle)
            val desc: TextView = itemView.findViewById(R.id.onboardingDesc)
        }
    }

    companion object {
        const val KEY_ONBOARDING_DONE = "onboarding_done"
    }
}
